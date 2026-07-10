"""
main.py — Application entry point.

Run:  python main.py
EXE:  pyinstaller main.spec  (see packaging instructions)
"""

import logging
import sys
from pathlib import Path

# ── Logging setup (file + console) ────────────────────────────────────────────
LOG_FILE = Path(__file__).parent / "data" / "spaylater.log"
LOG_FILE.parent.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)

log = logging.getLogger(__name__)


def main() -> None:
    log.info("=== Spaylater Manager starting ===")
    try:
        from app.ui.app_window import AppWindow
        window = AppWindow()
        window.run()
    except Exception as exc:
        log.critical("Fatal error: %s", exc, exc_info=True)
        # Show tkinter error dialog if possible
        try:
            import tkinter as tk
            from tkinter import messagebox
            root = tk.Tk()
            root.withdraw()
            messagebox.showerror(
                "Spaylater — Fatal Error",
                f"The application encountered a fatal error and must close.\n\n{exc}\n\n"
                f"Check data/spaylater.log for details.",
            )
            root.destroy()
        except Exception:
            pass
        sys.exit(1)
    log.info("=== Spaylater Manager closed ===")


if __name__ == "__main__":
    main()