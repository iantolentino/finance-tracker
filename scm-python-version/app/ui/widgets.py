"""
ui/widgets.py — Shared widget helpers and base Panel class.

All panels inherit from BasePanel which gives them:
  - self.frame    (tk.Frame in parent, themed)
  - self.app      (AppWindow reference)
  - self.state    (StateManager shortcut)
  - helpers: btn(), label(), entry(), section_header()
"""

from __future__ import annotations
import tkinter as tk
from tkinter import ttk
from typing import Callable, Optional

from app.config import THEME


class BasePanel:
    def __init__(self, parent: tk.Widget, app) -> None:
        self.app   = app
        self.state = app.state
        T = THEME
        self.frame = tk.Frame(parent, bg=T["bg"])

    # ── Widget factories ──────────────────────────────────────────────────────
    def section_header(self, parent: tk.Widget, text: str) -> tk.Label:
        T = THEME
        lbl = tk.Label(parent, text=text, bg=T["bg"],
                       fg=T["accent"], font=T["font_heading"],
                       anchor="w", pady=8)
        lbl.pack(fill=tk.X, padx=4)
        tk.Frame(parent, bg=T["accent_dim"], height=1).pack(fill=tk.X, pady=(0, 12))
        return lbl

    def card(self, parent: tk.Widget, **kwargs) -> tk.Frame:
        T = THEME
        defaults = dict(bg=T["bg_card"], padx=16, pady=14,
                        highlightbackground=T["border"], highlightthickness=1)
        defaults.update(kwargs)
        return tk.Frame(parent, **defaults)

    def btn(
        self, parent: tk.Widget, text: str, command: Callable,
        accent: bool = False, danger: bool = False, width: int = 0,
    ) -> tk.Button:
        T = THEME
        if danger:
            bg, fg, hover = T["danger"], "#fff", "#ff6b6b"
        elif accent:
            bg, fg, hover = T["accent"], "#000", T["accent_hover"]
        else:
            bg, fg, hover = T["bg_panel"], T["text"], T["bg_card"]

        b = tk.Button(
            parent, text=text, command=command,
            bg=bg, fg=fg, activebackground=hover, activeforeground=fg,
            font=T["font_body"], bd=0, relief=tk.FLAT,
            padx=14, pady=6, cursor="hand2",
            width=width,
        )
        b.bind("<Enter>", lambda e: b.configure(bg=hover))
        b.bind("<Leave>", lambda e: b.configure(bg=bg))
        return b

    def labeled_entry(
        self, parent: tk.Widget, label: str, textvariable: tk.StringVar,
        placeholder: str = "", width: int = 24,
    ) -> ttk.Entry:
        T = THEME
        f = tk.Frame(parent, bg=T["bg"])
        tk.Label(f, text=label, bg=T["bg"], fg=T["text_muted"],
                 font=("Courier New", 9)).pack(anchor="w")
        e = ttk.Entry(f, textvariable=textvariable, width=width)
        e.pack(fill=tk.X, ipady=4)
        f.pack(fill=tk.X, pady=4)
        return e

    def info_box(self, parent: tk.Widget, text: str, color: str = "text_muted") -> tk.Label:
        T = THEME
        lbl = tk.Label(parent, text=text, bg=T["bg_card"], fg=T[color],
                       font=T["font_small"], anchor="w", padx=10, pady=6,
                       wraplength=340, justify=tk.LEFT)
        lbl.pack(fill=tk.X, padx=0, pady=4)
        return lbl

    def separator(self, parent: tk.Widget) -> None:
        tk.Frame(parent, bg=THEME["border"], height=1).pack(fill=tk.X, pady=10)

    def refresh(self) -> None:
        """Override in subclass to refresh UI on navigation."""
        pass