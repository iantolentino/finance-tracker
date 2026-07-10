"""
ui/user_panel.py — Admin user management panel.

Allows adding / removing users (name + optional email).
Shows all users in a styled treeview.
"""

from __future__ import annotations
import tkinter as tk
from tkinter import ttk, messagebox

from app.config import THEME
from app.ui.widgets import BasePanel


class UserPanel(BasePanel):

    def __init__(self, parent: tk.Widget, app) -> None:
        super().__init__(parent, app)
        self._build()

    def _build(self) -> None:
        T = THEME
        main = self.frame

        # ── Title bar ─────────────────────────────────────────────────────────
        title_bar = tk.Frame(main, bg=T["bg_panel"], pady=16, padx=24)
        title_bar.pack(fill=tk.X)
        tk.Label(title_bar, text="User Management", bg=T["bg_panel"],
                 fg=T["text"], font=("Georgia", 18, "bold")).pack(side=tk.LEFT)

        # ── Body ──────────────────────────────────────────────────────────────
        body = tk.Frame(main, bg=T["bg"])
        body.pack(fill=tk.BOTH, expand=True, padx=24, pady=16)

        # LEFT — add form
        left = tk.Frame(body, bg=T["bg"], width=300)
        left.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 24))
        left.pack_propagate(False)
        self._build_form(left)

        # RIGHT — user list
        right = tk.Frame(body, bg=T["bg"])
        right.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self._build_user_list(right)

    def _build_form(self, parent: tk.Widget) -> None:
        T = THEME
        self.section_header(parent, "Add New User")

        self._name_var  = tk.StringVar()
        self._email_var = tk.StringVar()

        self.labeled_entry(parent, "Full Name *", self._name_var)
        self.labeled_entry(parent, "Email (optional)", self._email_var)

        self.btn(parent, "⊕  Add User", self._add_user, accent=True).pack(
            fill=tk.X, pady=(12, 4))

        self._feedback = tk.Label(parent, text="", bg=T["bg"], fg=T["success"],
                                   font=("Courier New", 9), wraplength=260)
        self._feedback.pack(anchor="w")

        self.separator(parent)

        # Info box
        info = self.card(parent)
        info.pack(fill=tk.X, pady=4)
        tk.Label(info, text="ℹ  Notes", bg=T["bg_card"], fg=T["accent"],
                 font=("Courier New", 9, "bold")).pack(anchor="w")
        tk.Label(
            info,
            text=(
                "• Name is required and must be unique.\n"
                "• Email enables one-click snapshot delivery.\n"
                "• Removing a user also removes all their items."
            ),
            bg=T["bg_card"], fg=T["text_muted"],
            font=("Courier New", 9), justify=tk.LEFT,
        ).pack(anchor="w", pady=(4, 0))

    def _build_user_list(self, parent: tk.Widget) -> None:
        T = THEME
        hdr = tk.Frame(parent, bg=T["bg"])
        hdr.pack(fill=tk.X, pady=(0, 8))
        tk.Label(hdr, text="All Users", bg=T["bg"], fg=T["text"],
                 font=("Georgia", 13, "bold")).pack(side=tk.LEFT)
        self._count_label = tk.Label(hdr, text="", bg=T["bg"],
                                      fg=T["text_muted"], font=("Courier New", 10))
        self._count_label.pack(side=tk.RIGHT)

        cols = ("name", "email", "items_this_month", "total_this_month")
        self._tree = ttk.Treeview(parent, columns=cols, show="headings", selectmode="browse")
        self._tree.heading("name",             text="Name")
        self._tree.heading("email",            text="Email")
        self._tree.heading("items_this_month", text="Items (this month)")
        self._tree.heading("total_this_month", text="Total (₱)")
        self._tree.column("name",             width=160, minwidth=100)
        self._tree.column("email",            width=200, minwidth=120)
        self._tree.column("items_this_month", width=140, anchor="center")
        self._tree.column("total_this_month", width=110, anchor="e")

        scroll = ttk.Scrollbar(parent, orient="vertical", command=self._tree.yview)
        self._tree.configure(yscrollcommand=scroll.set)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self._tree.pack(fill=tk.BOTH, expand=True)

        btn_row = tk.Frame(parent, bg=T["bg"])
        btn_row.pack(fill=tk.X, pady=(8, 0))
        self.btn(btn_row, "✕  Remove Selected User", self._remove_user, danger=True).pack(side=tk.LEFT)

    # ── Data ──────────────────────────────────────────────────────────────────
    def refresh(self) -> None:
        self._reload_list()

    def _reload_list(self) -> None:
        self._tree.delete(*self._tree.get_children())
        users = self.state.users
        month = self.app.current_month
        for u in users:
            items = self.state.items_for_user(u.id, month)
            total = sum(i.price for i in items)
            self._tree.insert("", tk.END, iid=u.id, values=(
                u.name,
                u.email or "—",
                len(items),
                f"₱ {total:.2f}" if items else "—",
            ))
        self._count_label.configure(text=f"{len(users)} user(s)")

    def _add_user(self) -> None:
        name  = self._name_var.get().strip()
        email = self._email_var.get().strip()
        if not name:
            self._show_feedback("Name is required.", error=True)
            return
        try:
            self.state.add_user(name, email)
            self._name_var.set("")
            self._email_var.set("")
            self._reload_list()
            self._show_feedback(f"User '{name}' added.", error=False)
            self.app.set_status(f"User '{name}' added.")
        except ValueError as exc:
            self._show_feedback(str(exc), error=True)

    def _remove_user(self) -> None:
        sel = self._tree.selection()
        if not sel:
            return
        user_id = sel[0]
        user = self.state.get_user(user_id)
        if not user:
            return
        if not messagebox.askyesno(
            "Remove User",
            f"Remove '{user.name}' and ALL their items?\nThis cannot be undone.",
        ):
            return
        self.state.remove_user(user_id)
        self._reload_list()
        self.app.set_status(f"User '{user.name}' removed.")

    def _show_feedback(self, msg: str, error: bool = False) -> None:
        T = THEME
        self._feedback.configure(text=msg, fg=T["danger"] if error else T["success"])
        self.frame.after(4000, lambda: self._feedback.configure(text=""))