const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { categoryForName } = require("../categories.js");

const OLD_FILE_ACTIONS = new Set(["sort", "delete", "review"]);

function reviewFolderName(days) {
  return `Janitor Review - Older Than ${days} Days`;
}

function getDownloadsDirectory() {
  return path.join(os.homedir(), "Downloads");
}

async function collectTopLevelFiles(targetDir) {
  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (!entry.isFile() || entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(targetDir, entry.name);
    const stats = await fs.stat(fullPath);

    files.push({
      name: entry.name,
      fullPath,
      size: stats.size,
      lastModified: stats.mtimeMs,
    });
  }

  return files.sort((left, right) => left.name.localeCompare(right.name));
}

function isOlderThan(lastModified, cutoffTimestamp) {
  return lastModified < cutoffTimestamp;
}

async function uniqueDestination(destinationDir, originalName) {
  let candidate = path.join(destinationDir, originalName);
  let counter = 1;
  const extension = path.extname(originalName);
  const baseName = path.basename(originalName, extension);

  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(destinationDir, `${baseName} (${counter})${extension}`);
      counter += 1;
    } catch {
      return candidate;
    }
  }
}

async function buildPlan({ days, oldFileAction, targetDir }) {
  if (!OLD_FILE_ACTIONS.has(oldFileAction)) {
    throw new Error("Unsupported old-file action.");
  }

  const cutoffTimestamp = Date.now() - days * 24 * 60 * 60 * 1000;
  const files = await collectTopLevelFiles(targetDir);

  return files.map((file) => {
    const category = categoryForName(file.name);
    const isOld = isOlderThan(file.lastModified, cutoffTimestamp);
    const isReview = isOld && oldFileAction === "review";

    return {
      name: file.name,
      fullPath: file.fullPath,
      category,
      size: file.size,
      lastModified: file.lastModified,
      isOld,
      isReview,
      action: isOld && oldFileAction === "delete" ? "delete" : "move",
    };
  });
}

async function chooseFolder(_event) {
  const result = await dialog.showOpenDialog({
    title: "Choose a folder to organise",
    buttonLabel: "Select Folder",
    properties: ["openDirectory"],
    defaultPath: getDownloadsDirectory(),
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
}

async function scanDownloadsFolder(_event, { days = 90, folderPath } = {}) {
  const targetDir = folderPath || getDownloadsDirectory();
  const records = await buildPlan({ days, oldFileAction: "sort", targetDir });

  return {
    folderPath: targetDir,
    folderName: path.basename(targetDir),
    records: records.map((record) => ({
      name: record.name,
      category: record.category,
      size: record.size,
      lastModified: record.lastModified,
      isOld: record.isOld,
      action: record.action,
    })),
  };
}

async function runDownloadsJanitor(event, { days = 90, oldFileAction = "sort", folderPath } = {}) {
  const targetDir = folderPath || getDownloadsDirectory();
  const records = await buildPlan({ days, oldFileAction, targetDir });
  let movedCount = 0;
  let deletedCount = 0;
  const total = records.length;
  const revertManifest = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];

    if (record.action === "delete") {
      await fs.unlink(record.fullPath);
      deletedCount += 1;
    } else {
      const destinationDir = record.isReview
        ? path.join(targetDir, reviewFolderName(days), record.category)
        : path.join(targetDir, record.category);
      await fs.mkdir(destinationDir, { recursive: true });
      const destinationPath = await uniqueDestination(destinationDir, record.name);
      await fs.rename(record.fullPath, destinationPath);
      revertManifest.push({ originalPath: record.fullPath, movedPath: destinationPath });
      movedCount += 1;
    }

    try {
      event.sender.send("janitor:progress", {
        completed: index + 1,
        total,
        fileName: record.name,
        action: record.action,
      });
    } catch {
      // Window may have been closed during processing — continue the run
    }
  }

  return {
    movedCount,
    deletedCount,
    total,
    folderPath: targetDir,
    revertManifest,
  };
}

async function undoLastRun(_event, { revertManifest } = {}) {
  if (!Array.isArray(revertManifest) || revertManifest.length === 0) {
    return { restoredCount: 0, errors: [] };
  }

  const errors = [];
  let restoredCount = 0;

  for (const entry of revertManifest) {
    try {
      await fs.rename(entry.movedPath, entry.originalPath);
      restoredCount += 1;
    } catch (err) {
      errors.push({ file: entry.movedPath, error: err.message });
    }
  }

  return { restoredCount, errors };
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 900,
    minHeight: 700,
    backgroundColor: "#efe6d7",
    title: "Downloads Folder Janitor",
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  window.loadFile(path.join(app.getAppPath(), "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("janitor:choose-folder", chooseFolder);
  ipcMain.handle("janitor:scan-downloads", scanDownloadsFolder);
  ipcMain.handle("janitor:run-downloads", runDownloadsJanitor);
  ipcMain.handle("janitor:undo", undoLastRun);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
