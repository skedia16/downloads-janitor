#!/usr/bin/env python3
"""Desktop UI for the Downloads Folder Janitor."""

from __future__ import annotations

import queue
import threading
import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk

from downloads_janitor import (
    build_plan,
    category_counts,
    execute_plan,
    summarize,
    validate_target,
)


TARGET_DIR = Path.home() / "Downloads"
OLD_FILE_DAYS = 90


class DownloadsJanitorApp(tk.Tk):
    def __init__(self) -> None:
        super().__init__()
        self.title("Downloads Folder Janitor")
        self.geometry("820x620")
        self.minsize(760, 540)
        self.configure(bg="#f4efe5")

        self.target_dir = validate_target(str(TARGET_DIR))
        self.old_file_action = tk.StringVar(value="sort")
        self.scan_records = []
        self.run_records = []
        self.events: queue.Queue[tuple[str, object]] = queue.Queue()

        self._configure_styles()
        self._build_shell()
        self.show_welcome_step()

    def _configure_styles(self) -> None:
        style = ttk.Style(self)
        if "clam" in style.theme_names():
            style.theme_use("clam")

        style.configure("App.TFrame", background="#f4efe5")
        style.configure(
            "Card.TFrame",
            background="#fffaf2",
            relief="flat",
        )
        style.configure(
            "Title.TLabel",
            background="#f4efe5",
            foreground="#243119",
            font=("Helvetica", 22, "bold"),
        )
        style.configure(
            "HeaderMeta.TLabel",
            background="#f4efe5",
            foreground="#66705c",
            font=("Helvetica", 11),
        )
        style.configure(
            "Body.TLabel",
            background="#fffaf2",
            foreground="#3f4638",
            font=("Helvetica", 13),
            wraplength=640,
        )
        style.configure(
            "Muted.TLabel",
            background="#fffaf2",
            foreground="#66705c",
            font=("Helvetica", 11),
            wraplength=640,
        )
        style.configure(
            "Action.TButton",
            font=("Helvetica", 12, "bold"),
            padding=(16, 10),
        )
        style.configure(
            "Secondary.TButton",
            font=("Helvetica", 12),
            padding=(14, 10),
        )
        style.configure(
            "Choice.TRadiobutton",
            background="#fffaf2",
            foreground="#3f4638",
            font=("Helvetica", 12),
        )
        style.configure(
            "Janitor.Horizontal.TProgressbar",
            troughcolor="#e5dccb",
            background="#7f9c48",
            bordercolor="#e5dccb",
            lightcolor="#7f9c48",
            darkcolor="#7f9c48",
        )

    def _build_shell(self) -> None:
        self.outer = ttk.Frame(self, style="App.TFrame", padding=24)
        self.outer.pack(fill="both", expand=True)

        header = ttk.Frame(self.outer, style="App.TFrame")
        header.pack(fill="x", pady=(0, 18))

        ttk.Label(
            header,
            text="Downloads Folder Janitor",
            style="Title.TLabel",
        ).pack(anchor="w")

        ttk.Label(
            header,
            text=f"Target folder: {self.target_dir}",
            style="HeaderMeta.TLabel",
        ).pack(anchor="w", pady=(6, 0))

        self.card = ttk.Frame(self.outer, style="Card.TFrame", padding=28)
        self.card.pack(fill="both", expand=True)

    def clear_card(self) -> None:
        for child in self.card.winfo_children():
            child.destroy()

    def show_welcome_step(self) -> None:
        self.clear_card()
        ttk.Label(
            self.card,
            text="1. Do you want to sort your downloads folder out?",
            style="Body.TLabel",
        ).pack(anchor="w", pady=(0, 14))

        ttk.Label(
            self.card,
            text=(
                "The janitor will scan the top level of your Downloads folder, "
                "suggest categories, and wait for your confirmation before it "
                "moves anything."
            ),
            style="Muted.TLabel",
        ).pack(anchor="w", pady=(0, 24))

        buttons = ttk.Frame(self.card, style="Card.TFrame")
        buttons.pack(anchor="w")

        ttk.Button(
            buttons,
            text="Yes",
            style="Action.TButton",
            command=self.show_scan_step,
        ).pack(side="left", padx=(0, 12))
        ttk.Button(
            buttons,
            text="No",
            style="Secondary.TButton",
            command=self.destroy,
        ).pack(side="left")

    def show_scan_step(self) -> None:
        self.clear_card()
        ttk.Label(
            self.card,
            text="2. Let me scan through your downloads folder.",
            style="Body.TLabel",
        ).pack(anchor="w", pady=(0, 10))

        ttk.Label(
            self.card,
            text=(
                "Are these categories fair for the files you have? "
                "These folders are based on the file types currently sitting "
                f"in {self.target_dir}."
            ),
            style="Muted.TLabel",
        ).pack(anchor="w", pady=(0, 20))

        try:
            self.scan_records = build_plan(
                target_dir=self.target_dir,
                days=OLD_FILE_DAYS,
                include_hidden=False,
                old_file_action="sort",
            )
        except Exception as exc:
            messagebox.showerror("Downloads Folder Janitor", str(exc))
            self.show_welcome_step()
            return

        counts = category_counts(self.scan_records)

        table_frame = ttk.Frame(self.card, style="Card.TFrame")
        table_frame.pack(fill="both", expand=True, pady=(0, 18))

        columns = ("category", "count")
        tree = ttk.Treeview(
            table_frame,
            columns=columns,
            show="headings",
            height=10,
        )
        tree.heading("category", text="Suggested Folder")
        tree.heading("count", text="Files")
        tree.column("category", width=420, anchor="w")
        tree.column("count", width=120, anchor="center")

        for category, count in counts:
            tree.insert("", "end", values=(category, count))

        if not counts:
            tree.insert("", "end", values=("No files to sort right now", 0))

        scrollbar = ttk.Scrollbar(
            table_frame,
            orient="vertical",
            command=tree.yview,
        )
        tree.configure(yscrollcommand=scrollbar.set)

        tree.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")

        buttons = ttk.Frame(self.card, style="Card.TFrame")
        buttons.pack(anchor="w")

        ttk.Button(
            buttons,
            text="Yes, these are fair",
            style="Action.TButton",
            command=self.show_old_files_step,
        ).pack(side="left", padx=(0, 12))
        ttk.Button(
            buttons,
            text="No",
            style="Secondary.TButton",
            command=self.destroy,
        ).pack(side="left")

    def show_old_files_step(self) -> None:
        self.clear_card()
        ttk.Label(
            self.card,
            text=(
                f"3. Do you want all files that are more than {OLD_FILE_DAYS} days old "
                "automatically deleted or sorted the same way as recent files?"
            ),
            style="Body.TLabel",
        ).pack(anchor="w", pady=(0, 18))

        choices = ttk.Frame(self.card, style="Card.TFrame")
        choices.pack(anchor="w", fill="x", pady=(0, 24))

        ttk.Radiobutton(
            choices,
            text=f"Automatically delete files older than {OLD_FILE_DAYS} days",
            value="delete",
            variable=self.old_file_action,
            style="Choice.TRadiobutton",
        ).pack(anchor="w", pady=(0, 12))

        ttk.Radiobutton(
            choices,
            text="Sort old files the same way as recent files",
            value="sort",
            variable=self.old_file_action,
            style="Choice.TRadiobutton",
        ).pack(anchor="w")

        ttk.Label(
            self.card,
            text=(
                "You can change this choice right up until the final run screen. "
                "The app will not touch anything before that final confirmation."
            ),
            style="Muted.TLabel",
        ).pack(anchor="w", pady=(0, 24))

        buttons = ttk.Frame(self.card, style="Card.TFrame")
        buttons.pack(anchor="w")

        ttk.Button(
            buttons,
            text="Continue",
            style="Action.TButton",
            command=self.show_run_step,
        ).pack(side="left", padx=(0, 12))
        ttk.Button(
            buttons,
            text="Back",
            style="Secondary.TButton",
            command=self.show_scan_step,
        ).pack(side="left")

    def show_run_step(self) -> None:
        self.clear_card()

        try:
            self.run_records = build_plan(
                target_dir=self.target_dir,
                days=OLD_FILE_DAYS,
                include_hidden=False,
                old_file_action=self.old_file_action.get(),
            )
        except Exception as exc:
            messagebox.showerror("Downloads Folder Janitor", str(exc))
            self.show_old_files_step()
            return

        action_text = (
            f"Delete files older than {OLD_FILE_DAYS} days"
            if self.old_file_action.get() == "delete"
            else f"Sort files older than {OLD_FILE_DAYS} days like recent files"
        )

        ttk.Label(
            self.card,
            text="4. Run the Downloads Janitor?",
            style="Body.TLabel",
        ).pack(anchor="w", pady=(0, 16))

        summary_box = tk.Text(
            self.card,
            height=10,
            wrap="word",
            relief="flat",
            bg="#f9f3e7",
            fg="#3f4638",
            font=("Helvetica", 12),
            padx=14,
            pady=14,
        )
        summary_box.pack(fill="both", expand=False, pady=(0, 22))
        summary_box.insert(
            "1.0",
            "\n".join(
                [
                    f"Target: {self.target_dir}",
                    f"Files ready to process: {len(self.run_records)}",
                    f"Old-file rule: {action_text}",
                    summarize(self.run_records),
                ]
            ),
        )
        summary_box.configure(state="disabled")

        buttons = ttk.Frame(self.card, style="Card.TFrame")
        buttons.pack(anchor="w")

        ttk.Button(
            buttons,
            text="Yes, run it",
            style="Action.TButton",
            command=self.show_progress_step,
        ).pack(side="left", padx=(0, 12))
        ttk.Button(
            buttons,
            text="No",
            style="Secondary.TButton",
            command=self.destroy,
        ).pack(side="left")

    def show_progress_step(self) -> None:
        self.clear_card()

        ttk.Label(
            self.card,
            text="Sorting your Downloads folder now",
            style="Body.TLabel",
        ).pack(anchor="w", pady=(0, 14))

        self.progress_value = tk.IntVar(value=0)
        self.progress_label = ttk.Label(
            self.card,
            text="0%",
            style="Muted.TLabel",
        )
        self.progress_label.pack(anchor="w", pady=(0, 10))

        self.progress_bar = ttk.Progressbar(
            self.card,
            maximum=100,
            variable=self.progress_value,
            style="Janitor.Horizontal.TProgressbar",
        )
        self.progress_bar.pack(fill="x", pady=(0, 18))

        self.status_label = ttk.Label(
            self.card,
            text="Starting...",
            style="Muted.TLabel",
        )
        self.status_label.pack(anchor="w")

        threading.Thread(target=self._run_janitor, daemon=True).start()
        self.after(100, self._drain_events)

    def _run_janitor(self) -> None:
        try:
            execute_plan(
                self.run_records,
                dry_run=False,
                progress_callback=self._queue_progress_event,
            )
            self.events.put(("done", summarize(self.run_records)))
        except Exception as exc:
            self.events.put(("error", str(exc)))

    def _queue_progress_event(self, completed: int, total: int, record) -> None:
        self.events.put(("progress", completed, total, record.source.name, record.action))

    def _drain_events(self) -> None:
        should_continue = True

        while True:
            try:
                event = self.events.get_nowait()
            except queue.Empty:
                break

            name = event[0]
            if name == "progress":
                _, completed, total, file_name, action = event
                percent = 100 if total == 0 else round((completed / total) * 100)
                self.progress_value.set(percent)
                self.progress_label.configure(text=f"{percent}%")
                verb = "Deleting" if action == "delete" else "Sorting"
                self.status_label.configure(text=f"{verb}: {file_name}")
            elif name == "done":
                _, summary_text = event
                self.progress_value.set(100)
                self.progress_label.configure(text="100%")
                self.status_label.configure(text=summary_text)
                messagebox.showinfo(
                    "Downloads Folder Janitor",
                    "Downloads Folder sorted!",
                )
                self._show_finish_button()
                should_continue = False
            elif name == "error":
                _, error_text = event
                messagebox.showerror("Downloads Folder Janitor", error_text)
                self._show_finish_button()
                should_continue = False

        if should_continue:
            self.after(100, self._drain_events)

    def _show_finish_button(self) -> None:
        controls = ttk.Frame(self.card, style="Card.TFrame")
        controls.pack(anchor="w", pady=(24, 0))
        ttk.Button(
            controls,
            text="Close",
            style="Action.TButton",
            command=self.destroy,
        ).pack(side="left")


def main() -> None:
    app = DownloadsJanitorApp()
    app.mainloop()


if __name__ == "__main__":
    main()
