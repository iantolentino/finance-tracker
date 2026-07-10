"""
ui/app_window.py — Root application window.

Layout:
  ┌──────────┬────────────────────────────────────┐
  │ SIDEBAR  │          CONTENT PANEL             │
  │  nav     │  (swapped by nav selection)        │
  └──────────┴────────────────────────────────────┘

Aesthetic: deep navy + amber — refined ledger / accountant's notebook.
Fonts: Georgia display headings, Courier New mono body.
"""

from __future__ import annotations
import logging
import sys
import tkinter as tk
from tkinter import ttk, messagebox
from datetime import datetime
from pathlib import Path

from app.config import APP_NAME, APP_VERSION, MIN_SIZE, THEME, ICON_FILE
from app.core.state_manager import StateManager
from app.core.csv_manager import CSVManager
from app.core.report_engine import ReportEngine

log = logging.getLogger(__name__)


class AppWindow:
    """Main application window. Owns the StateManager and passes it to panels."""

    def __init__(self) -> None:
        self.state = StateManager()
        self.csv   = CSVManager()
        self.report = ReportEngine()
        self.current_month = datetime.now().strftime("%Y-%m")

        self.root = tk.Tk()
        self._configure_root()
        self._apply_style()
        self._build_layout()
        self._build_sidebar()
        self._load_panels()
        self._navigate("items")   # default view

    # ── Window setup ──────────────────────────────────────────────────────────
    def _configure_root(self) -> None:
        self.root.title(f"{APP_NAME} v{APP_VERSION}")
        self.root.minsize(*MIN_SIZE)
        self.root.configure(bg=THEME["bg"])

        # Maximized on launch — keeps the title bar (minimize/restore/close intact).
        # This is NOT fullscreen (no F11); the taskbar stays visible.
        if sys.platform == "win32":
            self.root.state("zoomed")        # Windows native maximize
        else:
            # macOS / Linux: geometry = full screen size
            self.root.update_idletasks()
            sw = self.root.winfo_screenwidth()
            sh = self.root.winfo_screenheight()
            self.root.geometry(f"{sw}x{sh}+0+0")

        try:
            if ICON_FILE.exists():
                self.root.iconbitmap(str(ICON_FILE))
        except Exception:
            pass

    def _apply_style(self) -> None:
        """Configure ttk style to match the dark theme."""
        style = ttk.Style(self.root)
        style.theme_use("clam")
        T = THEME
        style.configure(".",
            background=T["bg"],
            foreground=T["text"],
            fieldbackground=T["bg_card"],
            bordercolor=T["border"],
            troughcolor=T["bg_panel"],
            font=T["font_body"],
        )
        style.configure("TFrame",    background=T["bg"])
        style.configure("TLabel",    background=T["bg"],       foreground=T["text"])
        style.configure("TEntry",    fieldbackground=T["bg_card"], foreground=T["text"],
                        insertcolor=T["accent"])
        style.configure("TCombobox", fieldbackground=T["bg_card"], foreground=T["text"],
                        selectbackground=T["accent"], selectforeground="#000")
        style.map("TCombobox",
            fieldbackground=[("readonly", T["bg_card"])],
            selectbackground=[("readonly", T["accent"])],
        )
        style.configure("TScrollbar",
            background=T["bg_panel"], troughcolor=T["bg"], arrowcolor=T["text_muted"])
        style.configure("Treeview",
            background=T["bg_card"], foreground=T["text"],
            fieldbackground=T["bg_card"], rowheight=26,
            font=T["font_mono"],
        )
        style.configure("Treeview.Heading",
            background=T["bg_panel"], foreground=T["accent"],
            font=T["font_heading"], relief="flat",
        )
        style.map("Treeview",
            background=[("selected", T["accent"])],
            foreground=[("selected", "#000")],
        )

    # ── Layout ────────────────────────────────────────────────────────────────
    def _build_layout(self) -> None:
        T = THEME
        # Sidebar
        self.sidebar = tk.Frame(self.root, bg=T["bg_sidebar"], width=200)
        self.sidebar.pack(side=tk.LEFT, fill=tk.Y)
        self.sidebar.pack_propagate(False)

        # Content area
        self.content = tk.Frame(self.root, bg=T["bg"])
        self.content.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Status bar at bottom of root
        self.status_var = tk.StringVar(value="Ready")
        self._status_bar = tk.Label(
            self.root,
            textvariable=self.status_var,
            bg=T["bg_sidebar"], fg=T["text_muted"],
            font=T["font_small"], anchor="w", padx=12, pady=4,
        )
        self._status_bar.pack(side=tk.BOTTOM, fill=tk.X)

    def _build_sidebar(self) -> None:
        T = THEME
        sb = self.sidebar

        # Logo / title
        logo_frame = tk.Frame(sb, bg=T["bg_sidebar"], pady=20)
        logo_frame.pack(fill=tk.X)
        tk.Label(logo_frame, text="◈", bg=T["bg_sidebar"], fg=T["accent"],
                 font=("Georgia", 28)).pack()
        tk.Label(logo_frame, text="SPAYLATER", bg=T["bg_sidebar"], fg=T["text"],
                 font=("Georgia", 13, "bold")).pack()
        tk.Label(logo_frame, text="Manager", bg=T["bg_sidebar"], fg=T["text_muted"],
                 font=("Courier New", 9)).pack()

        # Month display
        tk.Frame(sb, bg=T["border"], height=1).pack(fill=tk.X, padx=16)
        self.month_label = tk.Label(
            sb, text=f"📅 {self.current_month}",
            bg=T["bg_sidebar"], fg=T["accent_dim"],
            font=("Courier New", 9), pady=8,
        )
        self.month_label.pack()
        tk.Frame(sb, bg=T["border"], height=1).pack(fill=tk.X, padx=16)

        # Nav buttons
        self._nav_buttons = {}
        nav_items = [
            ("items",    "⊕  Add Items"),
            ("users",    "◉  Users"),
            ("reports",  "▦  Reports"),
            ("settings", "⚙  Settings"),
        ]
        tk.Frame(sb, bg=T["bg_sidebar"], height=12).pack()
        for key, label in nav_items:
            btn = tk.Button(
                sb,
                text=label,
                bg=T["bg_sidebar"], fg=T["text"],
                activebackground=T["accent"], activeforeground="#000",
                font=("Courier New", 11),
                bd=0, relief=tk.FLAT,
                anchor="w", padx=20, pady=10,
                cursor="hand2",
                command=lambda k=key: self._navigate(k),
            )
            btn.pack(fill=tk.X)
            btn.bind("<Enter>", lambda e, b=btn: b.configure(bg=T["bg_card"]))
            btn.bind("<Leave>", lambda e, b=btn: self._restore_nav_btn(b))
            self._nav_buttons[key] = btn

        # Version at bottom
        tk.Label(sb, text=f"v{APP_VERSION}",
                 bg=T["bg_sidebar"], fg=T["text_dim"],
                 font=("Courier New", 8)).pack(side=tk.BOTTOM, pady=8)

    def _restore_nav_btn(self, btn: tk.Button) -> None:
        """Restore sidebar button color unless it's the active one."""
        active_btn = self._nav_buttons.get(self._active_nav)
        if btn is not active_btn:
            btn.configure(bg=THEME["bg_sidebar"])

    # ── Panel management ──────────────────────────────────────────────────────
    def _load_panels(self) -> None:
        """Lazily import and instantiate all panels."""
        from app.ui.item_panel     import ItemPanel
        from app.ui.user_panel     import UserPanel
        from app.ui.report_panel   import ReportPanel
        from app.ui.settings_panel import SettingsPanel

        self._panels = {
            "items":    ItemPanel(self.content, self),
            "users":    UserPanel(self.content, self),
            "reports":  ReportPanel(self.content, self),
            "settings": SettingsPanel(self.content, self),
        }

    def _navigate(self, key: str) -> None:
        self._active_nav = key
        T = THEME
        for k, btn in self._nav_buttons.items():
            if k == key:
                btn.configure(bg=T["accent"], fg="#000")
            else:
                btn.configure(bg=T["bg_sidebar"], fg=T["text"])

        for k, panel in self._panels.items():
            if k == key:
                panel.frame.pack(fill=tk.BOTH, expand=True)
                if hasattr(panel, "refresh"):
                    panel.refresh()
            else:
                panel.frame.pack_forget()

    # ── Status helpers (called by panels) ─────────────────────────────────────
    def set_status(self, msg: str, error: bool = False) -> None:
        self.status_var.set(f"  {msg}")
        color = THEME["danger"] if error else THEME["text_muted"]
        self._status_bar.configure(fg=color)

    def run(self) -> None:
        self.root.mainloop()