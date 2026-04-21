// CATEGORY_MAP and categoryForName are loaded from categories.js via <script> in index.html

const OLD_FILE_DAYS = 90;
const OLD_FILE_MS = OLD_FILE_DAYS * 24 * 60 * 60 * 1000;
const REVIEW_FOLDER_NAME = `Janitor Review - Older Than ${OLD_FILE_DAYS} Days`;
const isDesktopApp = Boolean(window.electronAPI);

const state = {
  directoryHandle: null,
  directoryName: "",
  folderPath: "",
  records: [],
  oldFileAction: "sort",
  currentStep: 1,
  removeProgressListener: null,
  revertManifest: [],
};

const supportBanner = document.querySelector("#supportBanner");
const stepPanels = [...document.querySelectorAll(".step-panel")];
const stepIndicators = [...document.querySelectorAll("[data-step-indicator]")];
const categoryBoard = document.querySelector("#categoryBoard");
const folderNamePill = document.querySelector("#folderNamePill");
const fileCountPill = document.querySelector("#fileCountPill");
const oldCountPill = document.querySelector("#oldCountPill");
const summaryCard = document.querySelector("#summaryCard");
const progressFill = document.querySelector("#progressFill");
const progressLabel = document.querySelector("#progressLabel");
const progressMeta = document.querySelector("#progressMeta");
const activityLog = document.querySelector("#activityLog");
const successText = document.querySelector("#successText");
const exitMessage = document.querySelector("#exitMessage");

const startButton = document.querySelector("#startButton");
const exitButton = document.querySelector("#exitButton");
const categoriesFairButton = document.querySelector("#categoriesFairButton");
const rescanButton = document.querySelector("#rescanButton");
const oldFileNextButton = document.querySelector("#oldFileNextButton");
const oldFileBackButton = document.querySelector("#oldFileBackButton");
const summaryBackButton = document.querySelector("#summaryBackButton");
const runButton = document.querySelector("#runButton");
const restartButton = document.querySelector("#restartButton");
const undoButton = document.querySelector("#undoButton");
const undoWarning = document.querySelector("#undoWarning");

const choiceCards = [...document.querySelectorAll("[data-choice-card]")];
const actionInputs = [...document.querySelectorAll('input[name="old-file-action"]')];

init();

function init() {
  if (!isDesktopApp && !("showDirectoryPicker" in window)) {
    supportBanner.hidden = false;
    supportBanner.textContent =
      "This browser does not support direct folder sorting. Open this page in Chrome or Edge, or run the Electron desktop app.";
    startButton.disabled = true;
  }

  if (isDesktopApp) {
    startButton.textContent = "Yes, choose a folder to sort";
  }

  startButton.addEventListener("click", handleStart);
  exitButton.addEventListener("click", () => {
    exitMessage.hidden = false;
  });
  categoriesFairButton.addEventListener("click", () => showStep(3));
  rescanButton.addEventListener("click", handleStart);
  oldFileNextButton.addEventListener("click", () => {
    renderSummary();
    showStep(4);
  });
  oldFileBackButton.addEventListener("click", () => showStep(2));
  summaryBackButton.addEventListener("click", () => showStep(3));
  runButton.addEventListener("click", runJanitor);
  restartButton.addEventListener("click", resetApp);
  undoButton.addEventListener("click", undoRun);

  actionInputs.forEach((input) => {
    input.addEventListener("change", () => {
      state.oldFileAction = input.value;
      syncChoiceCards();
    });
  });

  if (isDesktopApp) {
    state.removeProgressListener = window.electronAPI.onProgress((payload) => {
      const percent = payload.total === 0 ? 100 : Math.round((payload.completed / payload.total) * 100);
      const verb = payload.action === "delete" ? "Deleted" : "Sorted";

      updateProgress(percent, `Processed ${payload.completed} of ${payload.total} files`);
      appendLog(`${verb}: ${payload.fileName}`);
    });
  }

  syncChoiceCards();
  showStep(1);
}

function showStep(stepNumber) {
  state.currentStep = stepNumber;

  stepPanels.forEach((panel) => {
    const isVisible = Number(panel.dataset.step) === stepNumber;
    panel.classList.toggle("is-visible", isVisible);
  });

  stepIndicators.forEach((indicator) => {
    const indicatorStep = Number(indicator.dataset.stepIndicator);
    indicator.classList.toggle("is-active", indicatorStep === stepNumber);
    indicator.classList.toggle("is-complete", indicatorStep < stepNumber);
  });
}

async function handleStart() {
  supportBanner.hidden = true;
  exitMessage.hidden = true;

  if (isDesktopApp) {
    await scanDesktopDownloads();
    return;
  }

  await chooseFolderInBrowser();
}

async function scanDesktopDownloads() {
  try {
    const chosenPath = await window.electronAPI.chooseFolder();
    if (!chosenPath) return; // user cancelled the dialog

    const result = await window.electronAPI.scanDownloadsFolder({ days: OLD_FILE_DAYS, folderPath: chosenPath });
    state.directoryName = result.folderName;
    state.folderPath = result.folderPath;
    state.records = result.records;

    renderCategoryBoard();
    showStep(2);
  } catch (error) {
    supportBanner.hidden = false;
    supportBanner.textContent = `Could not scan the selected folder: ${error.message}`;
  }
}

async function chooseFolderInBrowser() {
  try {
    const directoryHandle = await window.showDirectoryPicker({
      id: "downloads-janitor-folder",
      mode: "read",
    });

    state.directoryHandle = directoryHandle;
    state.directoryName = directoryHandle.name;
    state.folderPath = directoryHandle.name;
    state.records = await scanDirectory(directoryHandle);

    renderCategoryBoard();
    showStep(2);
  } catch (error) {
    if (error?.name === "AbortError") {
      return;
    }

    supportBanner.hidden = false;
    supportBanner.textContent = folderAccessMessage(error);
  }
}

async function scanDirectory(directoryHandle) {
  const records = [];

  for await (const entry of directoryHandle.values()) {
    if (entry.kind !== "file" || entry.name.startsWith(".")) {
      continue;
    }

    const file = await entry.getFile();
    records.push({
      handle: entry,
      name: entry.name,
      category: categoryForName(entry.name),
      size: file.size,
      lastModified: file.lastModified,
      isOld: Date.now() - file.lastModified > OLD_FILE_MS,
    });
  }

  return records.sort((left, right) => left.name.localeCompare(right.name));
}

function renderCategoryBoard() {
  const counts = new Map();
  let oldCount = 0;

  state.records.forEach((record) => {
    counts.set(record.category, (counts.get(record.category) || 0) + 1);
    if (record.isOld) {
      oldCount += 1;
    }
  });

  folderNamePill.textContent = state.folderPath || state.directoryName || "Downloads";
  fileCountPill.textContent = `${state.records.length} top-level file${state.records.length === 1 ? "" : "s"}`;
  oldCountPill.textContent = `${oldCount} older than ${OLD_FILE_DAYS} days`;

  if (!state.records.length) {
    categoryBoard.innerHTML = `
      <article class="category-card">
        <strong>No files to sort right now</strong>
        <span>The selected folder does not have any top-level files for the janitor to process.</span>
        <em>You can still continue and run a no-op pass.</em>
      </article>
    `;
    return;
  }

  const sortedCounts = [...counts.entries()].sort((left, right) =>
    left[0].localeCompare(right[0]),
  );

  categoryBoard.innerHTML = sortedCounts
    .map(
      ([category, count]) => `
        <article class="category-card">
          <strong>${escapeHtml(category)}</strong>
          <span>${count} file${count === 1 ? "" : "s"} will be grouped here</span>
          <em>${sampleExtensions(category)}</em>
        </article>
      `,
    )
    .join("");
}

function sampleExtensions(category) {
  if (category === "Other") {
    return "Mixed file types";
  }

  return CATEGORY_MAP[category].slice(0, 3).join("  ");
}

function renderSummary() {
  const totalFiles = state.records.length;
  const oldFiles = state.records.filter((record) => record.isOld).length;
  const actionText =
    state.oldFileAction === "delete"
      ? `Delete files older than ${OLD_FILE_DAYS} days`
      : state.oldFileAction === "review"
      ? `Move files older than ${OLD_FILE_DAYS} days to a review folder`
      : `Sort files older than ${OLD_FILE_DAYS} days into the same folders`;

  const destinationFolders = [...new Set(state.records.map((record) => record.category))]
    .sort((left, right) => left.localeCompare(right))
    .join(", ") || "No category folders needed";

  summaryCard.innerHTML = `
    ${summaryLine("Selected folder", state.folderPath || state.directoryName || "Downloads")}
    ${summaryLine("Top-level files to process", String(totalFiles))}
    ${summaryLine(`Files older than ${OLD_FILE_DAYS} days`, String(oldFiles))}
    ${summaryLine("Old-file rule", actionText)}
    ${summaryLine("Suggested folders", destinationFolders)}
  `;
}

function summaryLine(label, value) {
  return `
    <div class="summary-line">
      <span>${escapeHtml(label)}</span>
      <span>${escapeHtml(value)}</span>
    </div>
  `;
}

async function runJanitor() {
  if (isDesktopApp) {
    await runDesktopJanitor();
    return;
  }

  await runBrowserJanitor();
}

async function runDesktopJanitor() {
  showStep(5);
  activityLog.innerHTML = "";
  updateProgress(0, "Preparing files...");
  supportBanner.hidden = true;

  try {
    const result = await window.electronAPI.runDownloadsJanitor({
      days: OLD_FILE_DAYS,
      oldFileAction: state.oldFileAction,
      folderPath: state.folderPath,
    });

    state.revertManifest = result.revertManifest || [];
    updateProgress(100, `Processed ${result.total} of ${result.total} files`);
    finishRun(result.movedCount, result.deletedCount);
  } catch (error) {
    appendLog(`Run stopped: ${error.message}`);
    updateProgress(0, "The janitor stopped before finishing.");
    supportBanner.hidden = false;
    supportBanner.textContent = `The janitor could not finish: ${error.message}`;
    showStep(4);
  }
}

async function runBrowserJanitor() {
  const hasWritePermission = await ensureWritePermission(state.directoryHandle);
  if (!hasWritePermission) {
    supportBanner.hidden = false;
    supportBanner.textContent =
      "The browser would not grant write access to that folder. This usually happens with protected system folders. Try a normal folder, or run the Electron desktop app for your actual Downloads folder.";
    showStep(4);
    return;
  }

  showStep(5);
  activityLog.innerHTML = "";
  updateProgress(0, "Preparing files...");

  const totalFiles = state.records.length;
  const reservedNames = new Map();

  if (!totalFiles) {
    updateProgress(100, "No files needed sorting.");
    finishRun(0, 0);
    return;
  }

  let movedCount = 0;
  let deletedCount = 0;
  const revertManifest = [];

  try {
    for (let index = 0; index < state.records.length; index += 1) {
      const record = state.records[index];

      if (record.isOld && state.oldFileAction === "delete") {
        await state.directoryHandle.removeEntry(record.name);
        deletedCount += 1;
        appendLog(`Deleted old file: ${record.name}`);
      } else {
        const isReview = record.isOld && state.oldFileAction === "review";
        let targetDirectory;

        if (isReview) {
          const reviewFolder = await state.directoryHandle.getDirectoryHandle(
            REVIEW_FOLDER_NAME,
            { create: true },
          );
          targetDirectory = await reviewFolder.getDirectoryHandle(record.category, { create: true });
        } else {
          targetDirectory = await state.directoryHandle.getDirectoryHandle(
            record.category,
            { create: true },
          );
        }

        // Use a compound key so review and non-review files don't share reserved name sets
        const directoryKey = isReview ? `review:${record.category}` : record.category;
        const uniqueName = await getUniqueFileName(
          targetDirectory,
          record.name,
          directoryKey,
          reservedNames,
        );

        await copyFileIntoDirectory(record.handle, targetDirectory, uniqueName);
        try {
          await state.directoryHandle.removeEntry(record.name);
        } catch (removeError) {
          // Clean up the copy to avoid leaving a duplicate behind
          try { await targetDirectory.removeEntry(uniqueName); } catch {}
          throw removeError;
        }

        revertManifest.push({ originalName: record.name, targetDirectory, movedName: uniqueName });
        movedCount += 1;
        const destination = isReview
          ? `${REVIEW_FOLDER_NAME}/${record.category}/`
          : `${record.category}/`;
        appendLog(`Sorted ${record.name} into ${destination}`);
      }

      const percent = Math.round(((index + 1) / totalFiles) * 100);
      updateProgress(percent, `Processed ${index + 1} of ${totalFiles} files`);
    }

    state.revertManifest = revertManifest;
    finishRun(movedCount, deletedCount);
  } catch (error) {
    appendLog(`Run stopped: ${error.message}`);
    updateProgress(0, "The janitor stopped before finishing.");
    supportBanner.hidden = false;
    supportBanner.textContent = `The janitor could not finish: ${error.message}`;
    showStep(4);
  }
}

async function copyFileIntoDirectory(sourceHandle, destinationDirectory, destinationName) {
  const file = await sourceHandle.getFile();
  const destinationHandle = await destinationDirectory.getFileHandle(destinationName, {
    create: true,
  });
  const writable = await destinationHandle.createWritable();

  try {
    await writable.write(await file.arrayBuffer());
  } finally {
    await writable.close();
  }
}

async function getUniqueFileName(directoryHandle, originalName, directoryKey, reservedNames) {
  if (!reservedNames.has(directoryKey)) {
    reservedNames.set(directoryKey, new Set());
  }

  const reserved = reservedNames.get(directoryKey);
  let candidate = originalName;
  let counter = 1;
  const dotIndex = originalName.lastIndexOf(".");
  const baseName = dotIndex >= 0 ? originalName.slice(0, dotIndex) : originalName;
  const extension = dotIndex >= 0 ? originalName.slice(dotIndex) : "";

  while ((await entryExists(directoryHandle, candidate)) || reserved.has(candidate)) {
    candidate = `${baseName} (${counter})${extension}`;
    counter += 1;
  }

  reserved.add(candidate);
  return candidate;
}

async function entryExists(directoryHandle, entryName) {
  try {
    await directoryHandle.getFileHandle(entryName);
    return true;
  } catch (error) {
    if (error?.name !== "NotFoundError") throw error;
    return false;
  }
}

function updateProgress(percent, message) {
  progressFill.style.width = `${percent}%`;
  progressLabel.textContent = `${percent}%`;
  progressMeta.textContent = message;
}

function appendLog(message) {
  const entry = document.createElement("div");
  entry.className = "activity-entry";
  entry.textContent = message;
  activityLog.prepend(entry);
}

function finishRun(movedCount, deletedCount) {
  successText.textContent =
    deletedCount > 0
      ? `Sorted ${movedCount} files and deleted ${deletedCount} older file${deletedCount === 1 ? "" : "s"}.`
      : `Sorted ${movedCount} files into category folders.`;

  const canUndo = state.revertManifest.length > 0;
  undoButton.hidden = !canUndo;
  undoWarning.hidden = !(canUndo && deletedCount > 0);

  showStep(6);
}

async function undoRun() {
  undoButton.disabled = true;
  undoButton.textContent = "Undoing…";

  try {
    if (isDesktopApp) {
      const result = await window.electronAPI.undoLastRun({ revertManifest: state.revertManifest });
      if (result.errors && result.errors.length > 0) {
        supportBanner.hidden = false;
        supportBanner.textContent = `Undo finished with ${result.errors.length} error(s) — some files may not have been restored.`;
      }
    } else {
      for (const entry of state.revertManifest) {
        const fileHandle = await entry.targetDirectory.getFileHandle(entry.movedName);
        await copyFileIntoDirectory(fileHandle, state.directoryHandle, entry.originalName);
        await entry.targetDirectory.removeEntry(entry.movedName);
      }
    }

    state.revertManifest = [];
    successText.textContent = "Files have been moved back to their original locations.";
    undoButton.hidden = true;
    undoWarning.hidden = true;
  } catch (error) {
    undoButton.disabled = false;
    undoButton.textContent = "Undo this run";
    supportBanner.hidden = false;
    supportBanner.textContent = `Undo stopped: ${error.message}`;
  }
}

function syncChoiceCards() {
  choiceCards.forEach((card) => {
    const isSelected = card.dataset.choiceCard === state.oldFileAction;
    card.classList.toggle("is-selected", isSelected);
  });
}

function resetApp() {
  state.directoryHandle = null;
  state.directoryName = "";
  state.folderPath = "";
  state.records = [];
  state.oldFileAction = "sort";
  state.revertManifest = [];
  exitMessage.hidden = true;

  actionInputs.forEach((input) => {
    input.checked = input.value === "sort";
  });

  syncChoiceCards();
  folderNamePill.textContent = "No folder selected";
  fileCountPill.textContent = "0 files";
  oldCountPill.textContent = "0 old files";
  categoryBoard.innerHTML = "";
  summaryCard.innerHTML = "";
  activityLog.innerHTML = "";
  updateProgress(0, "Preparing files...");
  undoButton.hidden = true;
  undoButton.disabled = false;
  undoButton.textContent = "Undo this run";
  undoWarning.hidden = true;
  supportBanner.hidden = true;
  showStep(1);
}

async function ensureWritePermission(directoryHandle) {
  if (!directoryHandle) {
    return false;
  }

  try {
    const current = await directoryHandle.queryPermission({ mode: "readwrite" });
    if (current === "granted") {
      return true;
    }

    const requested = await directoryHandle.requestPermission({ mode: "readwrite" });
    return requested === "granted";
  } catch {
    return false;
  }
}

function folderAccessMessage(error) {
  const message = `${error?.message || ""}`.toLowerCase();

  if (
    message.includes("system files") ||
    message.includes("not allowed") ||
    message.includes("restricted") ||
    message.includes("sensitive")
  ) {
    return "Your browser is blocking that folder because it treats it as a protected system location. Try the Electron desktop app if you want to sort your real Downloads folder.";
  }

  return `Could not access the selected folder: ${error.message}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
