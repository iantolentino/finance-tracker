"""
config.py — Application-wide constants and defaults.
All magic strings/numbers live here; change here, change everywhere.
"""

import sys
from pathlib import Path

# ── Paths ─────────────────────────────────────────────────────────────────────
if getattr(sys, "frozen", False):
    # Running as EXE — save data next to the .exe file
    BASE_DIR = Path(sys.executable).parent
else:
    # Running as normal Python script
    BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR   = BASE_DIR / "data"
REPORT_DIR = DATA_DIR / "reports"
STATE_FILE = DATA_DIR / "state.json"
ASSETS_DIR = BASE_DIR / "assets"
ICON_FILE  = ASSETS_DIR / "icon.ico"

# ── Application ───────────────────────────────────────────────────────────────
APP_NAME    = "Spaylater Manager"
APP_VERSION = "1.0.0"
WINDOW_SIZE = "1100x720"
MIN_SIZE    = (900, 600)

# ── CSV ───────────────────────────────────────────────────────────────────────
CSV_DATE_FMT   = "%Y-%m"          # monthly file: 2025-07.csv
BACKUP_SUFFIX  = "_backup"
CSV_ENCODING   = "utf-8-sig"      # Excel-friendly UTF-8

# CSV column names (order matters — written as header)
CSV_COLUMNS = ["user", "item", "price", "added_at"]

# ── JSON State ────────────────────────────────────────────────────────────────
DEFAULT_STATE = {
    "users": [],          # list of {id, name, email}
    "items": [],          # list of {id, user_id, item, price, added_at, month}
    "email_settings": {
        "smtp_host": "smtp.gmail.com",
        "smtp_port": 587,
        "sender_email": "",
        "sender_password": "",
        "use_tls": True,
    },
    "meta": {
        "version": "1.0.0",
        "last_saved": None,
    },
}

# ── Email ─────────────────────────────────────────────────────────────────────
EMAIL_TIMEOUT = 10   # seconds before giving up

# ── UI Theme ──────────────────────────────────────────────────────────────────
# Deep navy + warm amber accent — refined ledger aesthetic
THEME = {
    "bg":           "#0D1117",   # near-black
    "bg_panel":     "#161B22",   # panel background
    "bg_card":      "#1C2333",   # card / entry background
    "bg_sidebar":   "#090D14",   # sidebar
    "accent":       "#E8A020",   # amber gold
    "accent_dim":   "#9E6C10",   # muted gold
    "accent_hover": "#F5B942",   # bright gold on hover
    "danger":       "#E05252",   # red for delete
    "success":      "#4CAF50",   # green for success
    "text":         "#E6EDF3",   # primary text
    "text_muted":   "#8B949E",   # secondary text
    "text_dim":     "#484F58",   # disabled / placeholder
    "border":       "#30363D",   # subtle border
    "border_focus": "#E8A020",   # focused border
    "font_display": ("Georgia", 20, "bold"),
    "font_heading": ("Georgia", 13, "bold"),
    "font_body":    ("Courier New", 11),
    "font_small":   ("Courier New", 9),
    "font_mono":    ("Courier New", 11),
    "radius":       8,
}