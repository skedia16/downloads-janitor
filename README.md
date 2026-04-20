# Downloads Folder Janitor

Downloads Folder Janitor now supports both a local Python workflow and a
browser-based web app that can be deployed with GitHub Pages.

## What this repo includes

- `index.html`, `styles.css`, `app.js`
  A static web app that asks the four janitor questions in the browser, scans a
  selected folder, shows suggested categories, and then sorts top-level files
  with a live 0 to 100 progress bar.
- `downloads_janitor.py`
  A command-line utility for sorting a Downloads folder from Terminal.
- `downloads_janitor_ui.py`
  A local desktop Tkinter version of the janitor flow.
- `.github/workflows/deploy-pages.yml`
  A GitHub Actions workflow that publishes the static web app to GitHub Pages.

## Important browser constraint

The web app can run from a GitHub Pages link, but browsers do not allow a page
to silently access your Mac's `~/Downloads` folder.

That means the browser version works like this:

1. You open the GitHub Pages URL.
2. The app asks you to choose your Downloads folder.
3. After you grant access, it scans only the top-level files in that folder.
4. When you approve the plan, it sorts those top-level files into category
   folders.

For best results, use Chrome or Edge on desktop. Safari does not fully support
the required folder access APIs.

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
