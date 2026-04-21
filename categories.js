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

function categoryForName(fileName) {
  const extensionIndex = fileName.lastIndexOf(".");
  const extension =
    extensionIndex >= 0 ? fileName.slice(extensionIndex).toLowerCase() : "";

  for (const [category, extensions] of Object.entries(CATEGORY_MAP)) {
    if (extensions.includes(extension)) {
      return category;
    }
  }

  return "Other";
}

// CommonJS export for Electron main process
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CATEGORY_MAP, categoryForName };
} else {
  // Browser global for renderer / plain browser use
  globalThis.CATEGORY_MAP = CATEGORY_MAP;
  globalThis.categoryForName = categoryForName;
}
