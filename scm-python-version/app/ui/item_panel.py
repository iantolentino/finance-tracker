"""
ui/item_panel.py — Add Spaylater items for a selected user.

Layout (two columns):
  LEFT:  User selector + Item form
  RIGHT: Treeview of items for selected user this month
"""

from __future__ import annotations
import tkinter as tk
from tkinter import ttk, messagebox
from datetime import datetime
from typing import Optional

from app.config import THEME
from app.models import User
from app.ui.widgets import BasePanel


class ItemPanel(BasePanel):

    def __init__(self, parent: tk.Widget, app) -> None:
        super().__init__(parent, app)
        self._selected_user: Optional[User] = None
        self._build()

    def _build(self) -> None:
        T = THEME
        main = self.frame
        main.configure(bg=T["bg"])

        # ── Title bar ─────────────────────────────────────────────────────────
        title_bar = tk.Frame(main, bg=T["bg_panel"], pady=16, padx=24)
        title_bar.pack(fill=tk.X)
        tk.Label(title_bar, text="Add Items", bg=T["bg_panel"],
                 fg=T["text"], font=("Georgia", 18, "bold")).pack(side=tk.LEFT)
        # Month badge
        self._month_badge = tk.Label(
            title_bar,
            text=f"  {self.app.current_month}  ",
            bg=T["accent"], fg="#000",
            font=("Courier New", 10, "bold"), padx=8, pady=3,
        )
        self._month_badge.pack(side=tk.RIGHT)

        # ── Two-column body ───────────────────────────────────────────────────
        body = tk.Frame(main, bg=T["bg"])
        body.pack(fill=tk.BOTH, expand=True, padx=24, pady=16)

        # LEFT COLUMN
        left = tk.Frame(body, bg=T["bg"], width=320)
        left.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 20))
        left.pack_propagate(False)
        self._build_form(left)

        # RIGHT COLUMN — item list
        right = tk.Frame(body, bg=T["bg"])
        right.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        self._build_item_list(right)

    def _build_form(self, parent: tk.Widget) -> None:
        T = THEME

        self.section_header(parent, "Select User")

        # User listbox
        lb_frame = tk.Frame(parent, bg=T["bg_card"],
                            highlightbackground=T["border"], highlightthickness=1)
        lb_frame.pack(fill=tk.X, pady=(0, 16))

        scrollbar = tk.Scrollbar(lb_frame, bg=T["bg_sidebar"])
        self._user_listbox = tk.Listbox(
            lb_frame,
            bg=T["bg_card"], fg=T["text"],
            selectbackground=T["accent"], selectforeground="#000",
            font=T["font_mono"],
            height=6, bd=0, relief=tk.FLAT,
            activestyle="none",
            yscrollcommand=scrollbar.set,
        )
        scrollbar.configure(command=self._user_listbox.yview)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self._user_listbox.pack(fill=tk.X, padx=8, pady=6)
        self._user_listbox.bind("<<ListboxSelect>>", self._on_user_select)

        # No-user hint
        self._no_user_hint = tk.Label(
            parent, text="No users yet. Add one in the Users tab.",
            bg=T["bg"], fg=T["text_muted"], font=("Courier New", 9),
            wraplength=280,
        )

        self.separator(parent)
        self.section_header(parent, "Add Item")

        # Item name
        self._item_name_var = tk.StringVar()
        self.labeled_entry(parent, "Item Name", self._item_name_var, width=28)

        # Price
        self._price_var = tk.StringVar()
        self.labeled_entry(parent, "Price (₱)", self._price_var, width=28)

        # Add button
        self._add_btn = self.btn(parent, "⊕  Add Item", self._add_item, accent=True)
        self._add_btn.pack(fill=tk.X, pady=(12, 4))

        # Feedback label
        self._feedback = tk.Label(parent, text="", bg=T["bg"], fg=T["success"],
                                   font=("Courier New", 9), wraplength=280)
        self._feedback.pack(anchor="w")

    def _build_item_list(self, parent: tk.Widget) -> None:
        T = THEME
        # Header
        hdr = tk.Frame(parent, bg=T["bg"])
        hdr.pack(fill=tk.X, pady=(0, 8))
        self._list_title = tk.Label(hdr, text="Items — select a user",
                                     bg=T["bg"], fg=T["text"], font=("Georgia", 13, "bold"))
        self._list_title.pack(side=tk.LEFT)
        self._subtotal_label = tk.Label(hdr, text="", bg=T["bg"],
                                         fg=T["accent"], font=("Courier New", 13, "bold"))
        self._subtotal_label.pack(side=tk.RIGHT)

        # Treeview
        cols = ("item", "price", "added_at")
        self._tree = ttk.Treeview(parent, columns=cols, show="headings", selectmode="browse")
        self._tree.heading("item",     text="Item")
        self._tree.heading("price",    text="Price (₱)")
        self._tree.heading("added_at", text="Added At")
        self._tree.column("item",     width=220, minwidth=120)
        self._tree.column("price",    width=110, anchor="e")
        self._tree.column("added_at", width=160, anchor="center")

        scroll = ttk.Scrollbar(parent, orient="vertical", command=self._tree.yview)
        self._tree.configure(yscrollcommand=scroll.set)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self._tree.pack(fill=tk.BOTH, expand=True)

        # Delete button
        del_btn = self.btn(parent, "✕  Remove Selected Item", self._remove_item, danger=True)
        del_btn.pack(pady=(8, 0))

    # ── Data operations ───────────────────────────────────────────────────────
    def refresh(self) -> None:
        self._reload_users()
        self._reload_items()

    def _reload_users(self) -> None:
        self._user_listbox.delete(0, tk.END)
        users = self.state.users
        if not users:
            self._no_user_hint.pack(pady=4)
        else:
            self._no_user_hint.pack_forget()
            for u in users:
                self._user_listbox.insert(tk.END, f"  {u.name}")
        self._users_cache = users

    def _on_user_select(self, event=None) -> None:
        sel = self._user_listbox.curselection()
        if not sel:
            return
        idx = sel[0]
        if idx < len(self._users_cache):
            self._selected_user = self._users_cache[idx]
            self._reload_items()

    def _reload_items(self) -> None:
        self._tree.delete(*self._tree.get_children())
        if not self._selected_user:
            self._list_title.configure(text="Items — select a user")
            self._subtotal_label.configure(text="")
            return

        month = self.app.current_month
        items = self.state.items_for_user(self._selected_user.id, month)
        self._list_title.configure(text=f"{self._selected_user.name}  ·  {month}")
        for item in items:
            self._tree.insert("", tk.END, iid=item.id, values=(
                item.item,
                f"₱ {item.price:.2f}",
                item.added_at[:16].replace("T", "  "),
            ))
        total = sum(i.price for i in items)
        self._subtotal_label.configure(text=f"₱ {total:,.2f}")

    def _add_item(self) -> None:
        if not self._selected_user:
            self._show_feedback("Select a user first.", error=True)
            return
        name  = self._item_name_var.get().strip()
        price_str = self._price_var.get().strip()
        if not name:
            self._show_feedback("Item name is required.", error=True)
            return
        try:
            price = float(price_str.replace(",", ""))
            if price < 0:
                raise ValueError
        except ValueError:
            self._show_feedback("Enter a valid positive price.", error=True)
            return

        try:
            self.state.add_item(
                user_id=self._selected_user.id,
                item_name=name,
                price=price,
                month=self.app.current_month,
            )
            # Write CSV immediately
            self.app.csv.write_month(
                self.app.current_month,
                self.state.items_for_month(self.app.current_month),
                self.state.users,
            )
            self._item_name_var.set("")
            self._price_var.set("")
            self._reload_items()
            self._show_feedback(f"Added: {name}  ₱{price:.2f}", error=False)
            self.app.set_status(f"Item added for {self._selected_user.name}")
        except Exception as exc:
            self._show_feedback(str(exc), error=True)

    def _remove_item(self) -> None:
        sel = self._tree.selection()
        if not sel:
            return
        item_id = sel[0]
        if not messagebox.askyesno("Remove Item", "Remove this item?"):
            return
        self.state.remove_item(item_id)
        self.app.csv.write_month(
            self.app.current_month,
            self.state.items_for_month(self.app.current_month),
            self.state.users,
        )
        self._reload_items()
        self.app.set_status("Item removed.")

    def _show_feedback(self, msg: str, error: bool = False) -> None:
        T = THEME
        self._feedback.configure(text=msg, fg=T["danger"] if error else T["success"])
        self.frame.after(4000, lambda: self._feedback.configure(text=""))