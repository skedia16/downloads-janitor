# Downloads Folder Janitor

Downloads Folder Janitor now supports:

- an Electron desktop app for the real macOS `~/Downloads` folder
- a local Python workflow
- a browser-based web app that can be deployed with GitHub Pages

## What this repo includes

- `package.json`, `electron/main.js`, `electron/preload.js`
  An Electron desktop app that uses the same guided UI but runs against your
  real `~/Downloads` folder on your Mac.
- `index.html`, `styles.css`, `app.js`
  The shared renderer UI. In Electron it powers the desktop app. In a browser,
  it can also run as a GitHub Pages demo against a user-selected folder.
- `downloads_janitor.py`
  A command-line utility for sorting a Downloads folder from Terminal.
- `downloads_janitor_ui.py`
  A local desktop Tkinter version of the janitor flow.
- `.github/workflows/deploy-pages.yml`
  A GitHub Actions workflow that publishes the static web app to GitHub Pages.

## Recommended way to use it

If you want to sort your actual macOS `~/Downloads` folder, use the Electron
desktop app. That is the version designed for real local file access.

Install dependencies:

```bash
npm install
```

Launch the desktop app:

```bash
npm start
```

## Make it public for other people

The most user-friendly GitHub setup is:

1. Push the Electron app source to GitHub.
2. Build a downloadable macOS app artifact.
3. Attach that artifact to a GitHub Release.
4. Send people the Release page, not just the repository homepage.

This repo now includes Electron Forge packaging and a GitHub Actions workflow
for macOS builds.

### Build a downloadable app locally

Create distributable artifacts on your Mac:

```bash
npm run make
```

The build output will be created under:

```bash
out/make/
```

You should expect macOS-friendly distributables such as a `.zip` and `.dmg`.

### Build through GitHub Actions

This repo includes:

- `.github/workflows/build-desktop.yml`
- `forge.config.js`

To build on GitHub:

1. Push your latest changes.
2. Create and push a tag like `v1.0.0`.
3. Open the `Actions` tab in GitHub.
4. Open the `Build Desktop App` workflow run.
5. Download the `downloads-folder-janitor-macos` artifact.

GitHub workflow artifacts are downloadable from the Actions run summary page.
GitHub documents this artifact flow here:
[Workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts)
and
[Downloading workflow artifacts](https://docs.github.com/en/actions/managing-workflow-runs/downloading-workflow-artifacts).

### Best sharing flow for non-technical users

For non-technical users, the cleanest distribution flow is:

1. Build the app artifact.
2. Create a GitHub Release, for example `v1.0.0`.
3. Upload the generated `.dmg` and `.zip` files to that Release.
4. Tell users to download the app from the Releases page.

Important: unsigned macOS apps may trigger a warning the first time someone
opens them. Electron recommends code signing for desktop distribution because
macOS and Windows trust signed apps more easily:
[Electron packaging tutorial](https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging).

## Browser constraint

The web app can run from a GitHub Pages link, but browsers do not allow a page
to silently access your Mac's `~/Downloads` folder.

That means the browser version works like this:

1. You open the GitHub Pages URL.
2. The app asks you to choose your Downloads folder.
3. After you grant access, it scans only the top-level files in that folder.
4. When you approve the plan, it sorts those top-level files into category
   folders.

For best results, use Chrome or Edge on desktop. Safari does not fully support
the required folder access APIs, and protected folders like macOS `Downloads`
may still be blocked by the browser.

## Web app flow

The browser version asks:

1. Do you want to sort your downloads folder out?
2. Let me scan through your downloads folder. Are these categories fair?
3. Do you want files older than 90 days deleted or sorted normally?
4. Run the Downloads Janitor?

When you confirm, the app shows a live progress bar and finishes with a
`Downloads Folder sorted!` success screen.

## GitHub Pages link

Once GitHub Pages is enabled for this repository, the live app URL will be:

`https://skedia16.github.io/downloads-janitor/`

Important: the repository page on `github.com` shows the code. The GitHub Pages
URL is the actual web app.

## How to enable GitHub Pages

Because this repo now includes a Pages deployment workflow, the remaining setup
is in GitHub:

1. Open the repository on GitHub.
2. Go to `Settings` -> `Pages`.
3. Under `Build and deployment`, choose `GitHub Actions`.
4. Push the latest commit from this repo.
5. After the workflow finishes, open the Pages URL shown above.

## Category buckets

- `Images`
- `Documents`
- `Spreadsheets`
- `Presentations`
- `Archives`
- `Installers`
- `Audio`
- `Video`
- `Code`
- `Other`

## Local Python options

Launch the desktop UI:

```bash
python3 downloads_janitor_ui.py
```

Run the CLI:

```bash
python3 downloads_janitor.py
```

Preview changes without moving anything:

```bash
python3 downloads_janitor.py --dry-run
```

Choose how old files should be handled in the CLI:

```bash
python3 downloads_janitor.py --old-files review
python3 downloads_janitor.py --old-files sort
python3 downloads_janitor.py --old-files delete
```
