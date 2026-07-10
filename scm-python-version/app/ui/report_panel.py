"""
ui/report_panel.py — Reports & Snapshots panel.

Features:
  - Month selector (all months with data)
  - Per-user snapshot preview (plain text)
  - Save snapshot CSV locally
  - Email snapshot to user
  - Full monthly CSV export
"""

from __future__ import annotations
import tkinter as tk
from tkinter import ttk, messagebox, filedialog
from datetime import datetime
from typing import Optional

from app.config import THEME, REPORT_DIR
from app.models import User
from app.core.report_engine import ReportEngine
from app.email_module.sender import send_snapshot
from app.ui.widgets import BasePanel


class ReportPanel(BasePanel):

    def __init__(self, parent: tk.Widget, app) -> None:
        super().__init__(parent, app)
        self._selected_user: Optional[User] = None
        self._selected_month: str = app.current_month
        self._report = ReportEngine()
        self._build()

    def _build(self) -> None:
        T = THEME
        main = self.frame

        # ── Title bar ─────────────────────────────────────────────────────────
        title_bar = tk.Frame(main, bg=T["bg_panel"], pady=16, padx=24)
        title_bar.pack(fill=tk.X)
        tk.Label(title_bar, text="Reports & Snapshots", bg=T["bg_panel"],
                 fg=T["text"], font=("Georgia", 18, "bold")).pack(side=tk.LEFT)

        # ── Body ──────────────────────────────────────────────────────────────
        body = tk.Frame(main, bg=T["bg"])
        body.pack(fill=tk.BOTH, expand=True, padx=24, pady=16)

        # LEFT control column
        left = tk.Frame(body, bg=T["bg"], width=280)
        left.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 20))
        left.pack_propagate(False)
        self._build_controls(left)

        # RIGHT preview column
        right = tk.Frame(body, bg=T["bg"])
        right.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self._build_preview(right)

    def _build_controls(self, parent: tk.Widget) -> None:
        T = THEME

        # ── Month selector ────────────────────────────────────────────────────
        self.section_header(parent, "Month")
        self._month_var = tk.StringVar(value=self._selected_month)
        self._month_combo = ttk.Combobox(parent, textvariable=self._month_var,
                                          state="readonly", width=18)
        self._month_combo.pack(fill=tk.X, pady=(0, 4))
        self._month_combo.bind("<<ComboboxSelected>>", self._on_month_change)

        self.separator(parent)

        # ── User selector ─────────────────────────────────────────────────────
        self.section_header(parent, "User Snapshot")
        lb_frame = tk.Frame(parent, bg=T["bg_card"],
                            highlightbackground=T["border"], highlightthickness=1)
        lb_frame.pack(fill=tk.X, pady=(0, 8))
        sb = tk.Scrollbar(lb_frame)
        self._user_lb = tk.Listbox(
            lb_frame, bg=T["bg_card"], fg=T["text"],
            selectbackground=T["accent"], selectforeground="#000",
            font=T["font_mono"], height=5, bd=0, activestyle="none",
            yscrollcommand=sb.set,
        )
        sb.configure(command=self._user_lb.yview)
        sb.pack(side=tk.RIGHT, fill=tk.Y)
        self._user_lb.pack(fill=tk.X, padx=6, pady=4)
        self._user_lb.bind("<<ListboxSelect>>", self._on_user_select)

        # Action buttons for user snapshot
        self.btn(parent, "👁  Preview Snapshot", self._preview_snapshot).pack(fill=tk.X, pady=2)
        self.btn(parent, "💾  Save Snapshot CSV", self._save_snapshot_csv).pack(fill=tk.X, pady=2)
        self.btn(parent, "✉  Email Snapshot", self._email_snapshot, accent=True).pack(
            fill=tk.X, pady=2)

        self.separator(parent)

        # ── Monthly export ────────────────────────────────────────────────────
        self.section_header(parent, "Monthly Export")
        self.btn(parent, "📄  Export Monthly CSV", self._export_monthly_csv).pack(
            fill=tk.X, pady=2)
        self.btn(parent, "📋  View Monthly Summary", self._view_monthly_summary).pack(
            fill=tk.X, pady=2)

        self.separator(parent)

        # Status feedback
        self._feedback = tk.Label(parent, text="", bg=T["bg"], fg=T["success"],
                                   font=("Courier New", 9), wraplength=250, justify=tk.LEFT)
        self._feedback.pack(anchor="w")

    def _build_preview(self, parent: tk.Widget) -> None:
        T = THEME
        hdr = tk.Frame(parent, bg=T["bg"])
        hdr.pack(fill=tk.X, pady=(0, 8))
        tk.Label(hdr, text="Preview", bg=T["bg"], fg=T["text"],
                 font=("Georgia", 13, "bold")).pack(side=tk.LEFT)

        # Text area with scrollbar
        txt_frame = tk.Frame(parent, bg=T["bg_card"],
                             highlightbackground=T["border"], highlightthickness=1)
        txt_frame.pack(fill=tk.BOTH, expand=True)

        scroll_y = tk.Scrollbar(txt_frame)
        scroll_x = tk.Scrollbar(txt_frame, orient=tk.HORIZONTAL)
        self._preview_text = tk.Text(
            txt_frame,
            bg=T["bg_card"], fg=T["text"],
            font=("Courier New", 11),
            insertbackground=T["accent"],
            selectbackground=T["accent"], selectforeground="#000",
            bd=0, relief=tk.FLAT, padx=16, pady=12,
            wrap=tk.NONE,
            yscrollcommand=scroll_y.set,
            xscrollcommand=scroll_x.set,
            state=tk.DISABLED,
        )
        scroll_y.configure(command=self._preview_text.yview)
        scroll_x.configure(command=self._preview_text.xview)
        scroll_y.pack(side=tk.RIGHT, fill=tk.Y)
        scroll_x.pack(side=tk.BOTTOM, fill=tk.X)
        self._preview_text.pack(fill=tk.BOTH, expand=True)

        self._set_preview("Select a month and user to preview a snapshot.")

    # ── Helpers ───────────────────────────────────────────────────────────────
    def _set_preview(self, text: str) -> None:
        self._preview_text.configure(state=tk.NORMAL)
        self._preview_text.delete("1.0", tk.END)
        self._preview_text.insert("1.0", text)
        self._preview_text.configure(state=tk.DISABLED)

    def _show_feedback(self, msg: str, error: bool = False) -> None:
        T = THEME
        self._feedback.configure(text=msg, fg=T["danger"] if error else T["success"])
        self.frame.after(6000, lambda: self._feedback.configure(text=""))

    def _current_user_items(self):
        if not self._selected_user:
            return []
        return self.state.items_for_user(self._selected_user.id, self._selected_month)

    # ── Refresh ───────────────────────────────────────────────────────────────
    def refresh(self) -> None:
        self._reload_months()
        self._reload_users()

    def _reload_months(self) -> None:
        months = self.state.all_months()
        if self.app.current_month not in months:
            months = [self.app.current_month] + months
        self._month_combo["values"] = months
        if self._selected_month not in months:
            self._selected_month = months[0] if months else self.app.current_month
        self._month_var.set(self._selected_month)

    def _reload_users(self) -> None:
        self._user_lb.delete(0, tk.END)
        self._users_cache = self.state.users
        for u in self._users_cache:
            self._user_lb.insert(tk.END, f"  {u.name}")

    # ── Events ────────────────────────────────────────────────────────────────
    def _on_month_change(self, event=None) -> None:
        self._selected_month = self._month_var.get()
        self._selected_user = None
        self._set_preview("Select a user to preview their snapshot.")

    def _on_user_select(self, event=None) -> None:
        sel = self._user_lb.curselection()
        if not sel:
            return
        idx = sel[0]
        if idx < len(self._users_cache):
            self._selected_user = self._users_cache[idx]

    # ── Actions ───────────────────────────────────────────────────────────────
    def _preview_snapshot(self) -> None:
        if not self._selected_user:
            self._show_feedback("Select a user first.", error=True)
            return
        items = self._current_user_items()
        text = self._report.user_snapshot_text(
            self._selected_user, items, self._selected_month)
        self._set_preview(text)

    def _save_snapshot_csv(self) -> None:
        if not self._selected_user:
            self._show_feedback("Select a user first.", error=True)
            return
        items = self._current_user_items()
        try:
            path = self.app.csv.write_user_snapshot(
                self._selected_month, self._selected_user, items)
            # Offer save-as dialog
            dest = filedialog.asksaveasfilename(
                defaultextension=".csv",
                filetypes=[("CSV files", "*.csv"), ("All files", "*.*")],
                initialfile=path.name,
                initialdir=str(REPORT_DIR),
                title="Save Snapshot CSV",
            )
            if dest:
                import shutil
                shutil.copy2(path, dest)
                self._show_feedback(f"Saved: {dest}")
                self.app.set_status(f"Snapshot saved: {dest}")
            else:
                self._show_feedback(f"Auto-saved to: {path}")
        except Exception as exc:
            self._show_feedback(f"Save failed: {exc}", error=True)

    def _email_snapshot(self) -> None:
        if not self._selected_user:
            self._show_feedback("Select a user first.", error=True)
            return
        user = self._selected_user
        if not user.email:
            self._show_feedback(
                f"'{user.name}' has no email. Edit in Users tab.", error=True)
            return
        items = self._current_user_items()
        settings = self.state.email_settings

        # Build content
        plain = self._report.user_snapshot_text(user, items, self._selected_month)
        html  = self._report.user_snapshot_html(user, items, self._selected_month)
        subject = f"Spaylater Snapshot — {self._selected_month} — {user.name}"

        # Write attachment CSV
        try:
            attachment = self.app.csv.write_user_snapshot(
                self._selected_month, user, items)
        except Exception:
            attachment = None

        self._show_feedback("Sending email…")
        self.frame.update_idletasks()

        ok, msg = send_snapshot(
            settings=settings,
            recipient_email=user.email,
            recipient_name=user.name,
            subject=subject,
            html_body=html,
            plain_body=plain,
            attachment=attachment,
        )
        self._show_feedback(msg, error=not ok)
        self.app.set_status(msg, error=not ok)

    def _export_monthly_csv(self) -> None:
        month = self._selected_month
        items = self.state.items_for_month(month)
        if not items:
            self._show_feedback(f"No items for {month}.", error=True)
            return
        try:
            path = self.app.csv.write_month(month, items, self.state.users)
            dest = filedialog.asksaveasfilename(
                defaultextension=".csv",
                filetypes=[("CSV files", "*.csv")],
                initialfile=path.name,
                initialdir=str(REPORT_DIR),
                title="Export Monthly CSV",
            )
            if dest:
                import shutil
                shutil.copy2(path, dest)
                self._show_feedback(f"Exported: {dest}")
            else:
                self._show_feedback(f"Auto-saved: {path}")
        except Exception as exc:
            self._show_feedback(f"Export failed: {exc}", error=True)

    def _view_monthly_summary(self) -> None:
        month = self._selected_month
        items = self.state.items_for_month(month)
        text = self._report.monthly_summary_text(month, self.state.users, items)
        self._set_preview(text)