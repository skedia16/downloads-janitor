const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");

const CATEGORY_MAP = {
  Images: [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".bmp",
    ".tif",
    ".tiff",
    ".svg",
    ".heic",
    ".raw",
  ],
  Documents: [".pdf", ".doc", ".docx", ".txt", ".rtf", ".md", ".pages", ".odt"],
  Spreadsheets: [".xls", ".xlsx", ".csv", ".numbers", ".ods"],
  Presentations: [".ppt", ".pptx", ".key", ".odp"],
  Archives: [".zip", ".rar", ".7z", ".tar", ".gz", ".bz2", ".xz", ".tgz"],
  Installers: [".dmg", ".pkg", ".msi", ".exe", ".deb", ".rpm", ".appimage", ".iso"],
  Audio: [".mp3", ".wav", ".aac", ".flac", ".m4a", ".ogg"],
  Video: [".mp4", ".mov", ".avi", ".mkv", ".webm", ".wmv", ".m4v"],
  Code: [
    ".py",
    ".js",
    ".ts",
    ".tsx",
    ".jsx",
    ".java",
    ".c",
    ".cpp",
    ".rb",
    ".go",
    ".rs",
    ".html",
    ".css",
    ".json",
    ".xml",
    ".yml",
    ".yaml",
    ".sh",
  ],
};

const OLD_FILE_ACTIONS = new Set(["sort", "delete"]);

function getDownloadsDirectory() {
  return path.join(os.homedir(), "Downloads");
}

function categoryForName(fileName) {
  const extension = path.extname(fileName).toLowerCase();
  for (const [category, extensions] of Object.entries(CATEGORY_MAP)) {
    if (extensions.includes(extension)) {
      return category;
    }
  }
  return "Other";
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

async function buildPlan({ days, oldFileAction }) {
  if (!OLD_FILE_ACTIONS.has(oldFileAction)) {
    throw new Error("Unsupported old-file action.");
  }

  const targetDir = getDownloadsDirectory();
  const cutoffTimestamp = Date.now() - days * 24 * 60 * 60 * 1000;
  const files = await collectTopLevelFiles(targetDir);

  return files.map((file) => {
    const category = categoryForName(file.name);
    const isOld = isOlderThan(file.lastModified, cutoffTimestamp);

    return {
      name: file.name,
      fullPath: file.fullPath,
      category,
      size: file.size,
      lastModified: file.lastModified,
      isOld,
      action: isOld && oldFileAction === "delete" ? "delete" : "move",
    };
  });
}

async function scanDownloadsFolder(_event, { days = 90 } = {}) {
  const targetDir = getDownloadsDirectory();
  const records = await buildPlan({ days, oldFileAction: "sort" });

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

async function runDownloadsJanitor(event, { days = 90, oldFileAction = "sort" } = {}) {
  const targetDir = getDownloadsDirectory();
  const records = await buildPlan({ days, oldFileAction });
  let movedCount = 0;
  let deletedCount = 0;
  const total = records.length;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];

    if (record.action === "delete") {
      await fs.unlink(record.fullPath);
      deletedCount += 1;
    } else {
      const destinationDir = path.join(targetDir, record.category);
      await fs.mkdir(destinationDir, { recursive: true });
      const destinationPath = await uniqueDestination(destinationDir, record.name);
      await fs.rename(record.fullPath, destinationPath);
      movedCount += 1;
    }

    event.sender.send("janitor:progress", {
      completed: index + 1,
      total,
      fileName: record.name,
      action: record.action,
    });
  }

  return {
    movedCount,
    deletedCount,
    total,
    folderPath: targetDir,
  };
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
  ipcMain.handle("janitor:scan-downloads", scanDownloadsFolder);
  ipcMain.handle("janitor:run-downloads", runDownloadsJanitor);

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
