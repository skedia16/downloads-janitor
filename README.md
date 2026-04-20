# Downloads Folder Janitor

This project now includes:

- `downloads_janitor.py`: a command-line utility
- `downloads_janitor_ui.py`: a desktop UI for running the janitor with prompts

Both clean up a messy Downloads folder by sorting top-level files into category
folders such as `Images`, `Documents`, `Installers`, and `Archives`.

Files older than 60 days are treated differently:

- They are moved into a separate review folder named
  `Janitor Review - Older Than <N> Days`
- After the move, the script asks whether you want to delete that entire review
  folder

The desktop UI uses a 90-day rule and asks whether those older files should be
deleted automatically or sorted like recent files.

This makes it easy to keep recent downloads organized while batching old files
into one place for a quick cleanup decision.

## How it works

- Sorts only files in the top level of the target folder
- Leaves existing subfolders alone
- Skips hidden files by default
- Creates numbered filenames if a destination file already exists

## Usage

Launch the desktop UI:

```bash
python3 downloads_janitor_ui.py
```

Run it against your actual Downloads folder:

```bash
python3 downloads_janitor.py
```

Run it against a different folder:

```bash
python3 downloads_janitor.py /path/to/folder
```

Preview changes without moving anything:

```bash
python3 downloads_janitor.py --dry-run
```

Use a different age threshold:

```bash
python3 downloads_janitor.py --days 90
```

Choose how old files should be handled in the CLI:

```bash
python3 downloads_janitor.py --old-files review
python3 downloads_janitor.py --old-files sort
python3 downloads_janitor.py --old-files delete
```

Include hidden files:

```bash
python3 downloads_janitor.py --include-hidden
```

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

You can extend the category map inside
`/Users/shreyakedia/Documents/Downloads Janitor/downloads_janitor.py` if you
want different folder names or file types.
