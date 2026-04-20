#!/usr/bin/env python3
"""Sort a Downloads folder into category subfolders."""

from __future__ import annotations

import argparse
import shutil
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable


CATEGORY_MAP: dict[str, set[str]] = {
    "Images": {
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
    },
    "Documents": {
        ".pdf",
        ".doc",
        ".docx",
        ".txt",
        ".rtf",
        ".md",
        ".pages",
        ".odt",
    },
    "Spreadsheets": {
        ".xls",
        ".xlsx",
        ".csv",
        ".numbers",
        ".ods",
    },
    "Presentations": {
        ".ppt",
        ".pptx",
        ".key",
        ".odp",
    },
    "Archives": {
        ".zip",
        ".rar",
        ".7z",
        ".tar",
        ".gz",
        ".bz2",
        ".xz",
        ".tgz",
    },
    "Installers": {
        ".dmg",
        ".pkg",
        ".msi",
        ".exe",
        ".deb",
        ".rpm",
        ".appimage",
        ".iso",
    },
    "Audio": {
        ".mp3",
        ".wav",
        ".aac",
        ".flac",
        ".m4a",
        ".ogg",
    },
    "Video": {
        ".mp4",
        ".mov",
        ".avi",
        ".mkv",
        ".webm",
        ".wmv",
        ".m4v",
    },
    "Code": {
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
    },
}

OLD_FILE_ACTIONS = {"review", "sort", "delete"}


@dataclass(frozen=True)
class MoveRecord:
    source: Path
    category: str
    is_old: bool
    action: str
    destination: Path | None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Sort files in your Downloads folder into category folders based on "
            "extension. Old files can be reviewed, sorted normally, or deleted."
        )
    )
    parser.add_argument(
        "target",
        nargs="?",
        default=str(Path.home() / "Downloads"),
        help="Folder to organize. Defaults to ~/Downloads.",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=60,
        help="Age threshold in days for old-file handling. Defaults to 60.",
    )
    parser.add_argument(
        "--old-files",
        choices=sorted(OLD_FILE_ACTIONS),
        default="review",
        help=(
            "How to handle files older than --days: review, sort, or delete. "
            "Defaults to review."
        ),
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show what would happen without moving or deleting anything.",
    )
    parser.add_argument(
        "--include-hidden",
        action="store_true",
        help="Also process hidden files. Hidden files are skipped by default.",
    )
    return parser.parse_args()


def review_folder_name(days: int) -> str:
    return f"Janitor Review - Older Than {days} Days"


def category_for_file(file_path: Path) -> str:
    extension = file_path.suffix.lower()
    for category, extensions in CATEGORY_MAP.items():
        if extension in extensions:
            return category
    return "Other"


def is_older_than(file_path: Path, cutoff_timestamp: float) -> bool:
    return file_path.stat().st_mtime < cutoff_timestamp


def validate_target(target: str) -> Path:
    target_dir = Path(target).expanduser().resolve()
    if not target_dir.exists():
        raise FileNotFoundError(f"Target folder does not exist: {target_dir}")
    if not target_dir.is_dir():
        raise NotADirectoryError(f"Target path is not a folder: {target_dir}")
    return target_dir


def collect_top_level_files(target_dir: Path, include_hidden: bool) -> list[Path]:
    files: list[Path] = []
    for item in target_dir.iterdir():
        if item.is_dir():
            continue
        if not include_hidden and item.name.startswith("."):
            continue
        files.append(item)
    return sorted(files, key=lambda path: path.name.lower())


def safe_destination(
    destination_dir: Path,
    file_path: Path,
    reserved_paths: set[Path],
) -> Path:
    candidate = destination_dir / file_path.name
    if not candidate.exists() and candidate not in reserved_paths:
        reserved_paths.add(candidate)
        return candidate

    stem = file_path.stem
    suffix = file_path.suffix
    counter = 1
    while True:
        candidate = destination_dir / f"{stem} ({counter}){suffix}"
        if not candidate.exists() and candidate not in reserved_paths:
            reserved_paths.add(candidate)
            return candidate
        counter += 1


def build_plan(
    target_dir: Path,
    days: int,
    include_hidden: bool,
    old_file_action: str = "review",
) -> list[MoveRecord]:
    if old_file_action not in OLD_FILE_ACTIONS:
        raise ValueError(
            f"Unsupported old-file action: {old_file_action}. "
            f"Expected one of {sorted(OLD_FILE_ACTIONS)}."
        )

    now_timestamp = datetime.now().timestamp()
    cutoff_timestamp = now_timestamp - (days * 24 * 60 * 60)
    reserved_paths: set[Path] = set()
    review_root = target_dir / review_folder_name(days)
    records: list[MoveRecord] = []

    for file_path in collect_top_level_files(target_dir, include_hidden):
        category = category_for_file(file_path)
        old_file = is_older_than(file_path, cutoff_timestamp)

        if old_file and old_file_action == "delete":
            destination = None
            action = "delete"
        else:
            if old_file and old_file_action == "review":
                destination_dir = review_root / category
            else:
                destination_dir = target_dir / category

            destination = safe_destination(destination_dir, file_path, reserved_paths)
            action = "move"

        records.append(
            MoveRecord(
                source=file_path,
                category=category,
                is_old=old_file,
                action=action,
                destination=destination,
            )
        )

    return records


def category_counts(records: list[MoveRecord]) -> list[tuple[str, int]]:
    counts: dict[str, int] = {}
    for record in records:
        counts[record.category] = counts.get(record.category, 0) + 1
    return sorted(counts.items(), key=lambda item: (item[0].lower(), item[1]))


def summarize(records: list[MoveRecord]) -> str:
    if not records:
        return "No top-level files needed organizing."

    moved_count = sum(1 for record in records if record.action == "move")
    deleted_count = sum(1 for record in records if record.action == "delete")
    old_count = sum(1 for record in records if record.is_old)
    recent_count = len(records) - old_count
    categories = ", ".join(category for category, _ in category_counts(records))

    return (
        f"Processed {len(records)} file(s): {recent_count} recent, {old_count} old. "
        f"Moves: {moved_count}, deletes: {deleted_count}. "
        f"Categories used: {categories}."
    )


def record_description(record: MoveRecord, dry_run: bool) -> str:
    prefix = "[dry-run] " if dry_run else ""
    age_label = "old" if record.is_old else "recent"
    if record.action == "delete":
        return f"{prefix}{record.source.name} -> deleted ({age_label})"
    return f"{prefix}{record.source.name} -> {record.destination} ({age_label})"


def move_file(source: Path, destination: Path, dry_run: bool) -> None:
    if dry_run:
        return
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(source), str(destination))


def delete_file(file_path: Path, dry_run: bool) -> None:
    if dry_run:
        return
    file_path.unlink()


def delete_folder(folder: Path, dry_run: bool) -> None:
    if dry_run:
        return
    shutil.rmtree(folder)


def execute_plan(
    records: list[MoveRecord],
    dry_run: bool = False,
    progress_callback: Callable[[int, int, MoveRecord], None] | None = None,
) -> None:
    total = len(records)
    for index, record in enumerate(records, start=1):
        if record.action == "delete":
            delete_file(record.source, dry_run=dry_run)
        elif record.destination is not None:
            move_file(record.source, record.destination, dry_run=dry_run)

        if progress_callback is not None:
            progress_callback(index, total, record)


def maybe_prompt_to_delete_review_folder(
    target_dir: Path,
    records: list[MoveRecord],
    days: int,
    old_file_action: str,
    dry_run: bool,
) -> None:
    if old_file_action != "review":
        return

    old_records = [record for record in records if record.is_old]
    if not old_records:
        return

    review_folder = target_dir / review_folder_name(days)
    if dry_run:
        print(
            f"\n[dry-run] Older files would be moved into:\n  {review_folder}\n"
            "Run without --dry-run to review and choose whether to delete that folder."
        )
        return

    print(
        f"\nOlder files were moved into:\n  {review_folder}\n"
        "You can review that folder now, or delete the entire folder in one step."
    )

    prompt = "Delete the review folder now? [y/N]: "
    try:
        answer = input(prompt).strip().lower()
    except EOFError:
        print("Skipping delete prompt because no interactive input is available.")
        return

    if answer in {"y", "yes"}:
        delete_folder(review_folder, dry_run=dry_run)
        print(f"Deleted review folder: {review_folder}")
    else:
        print("Kept the review folder for later review.")


def main() -> int:
    args = parse_args()

    if args.days < 0:
        print("--days must be 0 or greater.", file=sys.stderr)
        return 2

    try:
        target_dir = validate_target(args.target)
    except (FileNotFoundError, NotADirectoryError) as exc:
        print(str(exc), file=sys.stderr)
        return 2

    if args.dry_run:
        print(f"[dry-run] Organizing: {target_dir}")
    else:
        print(f"Organizing: {target_dir}")

    try:
        records = build_plan(
            target_dir=target_dir,
            days=args.days,
            include_hidden=args.include_hidden,
            old_file_action=args.old_files,
        )
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2

    execute_plan(records, dry_run=args.dry_run)
    print(summarize(records))
    for record in records:
        print(record_description(record, dry_run=args.dry_run))

    maybe_prompt_to_delete_review_folder(
        target_dir=target_dir,
        records=records,
        days=args.days,
        old_file_action=args.old_files,
        dry_run=args.dry_run,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
