module.exports = {
  packagerConfig: {
    asar: true,
    appBundleId: "com.skedia.downloads-janitor",
    appCategoryType: "public.app-category.productivity",
    executableName: "Downloads Folder Janitor",
    name: "Downloads Folder Janitor",
  },
  makers: [
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-dmg",
      platforms: ["darwin"],
    },
  ],
};
