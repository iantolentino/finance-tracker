"""
core/csv_manager.py — Monthly CSV read / write / backup.

Schema (CSV columns):  user | item | price | added_at
One row per item; all rows for a month live in YYYY-MM.csv.
Human-editable: plain text, UTF-8 BOM (Excel-friendly).
"""

from __future__ import annotations
import csv
import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import List

from app.config import REPORT_DIR, CSV_COLUMNS, CSV_ENCODING, CSV_DATE_FMT, BACKUP_SUFFIX
from app.models import Item, User

log = logging.getLogger(__name__)


class CSVManager:
    """Handles all CSV file operations for monthly reports."""

    def __init__(self, report_dir: Path = REPORT_DIR) -> None:
        self.report_dir = report_dir
        self.report_dir.mkdir(parents=True, exist_ok=True)

    # ── Path helpers ──────────────────────────────────────────────────────────
    def csv_path(self, month: str) -> Path:
        return self.report_dir / f"{month}.csv"

    def backup_path(self, month: str) -> Path:
        return self.report_dir / f"{month}{BACKUP_SUFFIX}.csv"

    # ── Backup ────────────────────────────────────────────────────────────────
    def make_backup(self, month: str) -> bool:
        """Copy existing CSV to a backup file. Returns True if backup was made."""
        src = self.csv_path(month)
        if not src.exists():
            return False
        try:
            shutil.copy2(src, self.backup_path(month))
            log.info("Backup created: %s", self.backup_path(month))
            return True
        except Exception as exc:
            log.error("Backup failed for %s: %s", month, exc)
            return False

    # ── Write ─────────────────────────────────────────────────────────────────
    def write_month(self, month: str, items: List[Item], users: List[User]) -> Path:
        """
        Write (overwrite) a monthly CSV.
        Automatically makes a backup of the existing file first.
        Returns the path to the written file.
        """
        self.make_backup(month)

        user_map = {u.id: u.name for u in users}
        path = self.csv_path(month)

        try:
            with path.open("w", newline="", encoding=CSV_ENCODING) as f:
                writer = csv.DictWriter(f, fieldnames=CSV_COLUMNS)
                writer.writeheader()
                for item in items:
                    writer.writerow({
                        "user":     user_map.get(item.user_id, item.user_id),
                        "item":     item.item,
                        "price":    f"{item.price:.2f}",
                        "added_at": item.added_at,
                    })
            log.info("CSV written: %s (%d rows)", path, len(items))
            return path
        except Exception as exc:
            log.error("CSV write failed: %s", exc)
            raise

    # ── User snapshot CSV ─────────────────────────────────────────────────────
    def write_user_snapshot(self, month: str, user: User, items: List[Item]) -> Path:
        """Write a per-user snapshot CSV to the reports directory."""
        safe_name = "".join(c for c in user.name if c.isalnum() or c in " _-").strip()
        path = self.report_dir / f"{month}_{safe_name}_snapshot.csv"

        try:
            with path.open("w", newline="", encoding=CSV_ENCODING) as f:
                writer = csv.DictWriter(f, fieldnames=["item", "price", "added_at"])
                writer.writeheader()
                for item in items:
                    writer.writerow({
                        "item":     item.item,
                        "price":    f"{item.price:.2f}",
                        "added_at": item.added_at,
                    })
                # total row
                total = sum(i.price for i in items)
                writer.writerow({"item": "TOTAL", "price": f"{total:.2f}", "added_at": ""})
            log.info("User snapshot written: %s", path)
            return path
        except Exception as exc:
            log.error("User snapshot write failed: %s", exc)
            raise

    # ── Read (for display / import) ───────────────────────────────────────────
    def read_month(self, month: str) -> List[dict]:
        """Read a monthly CSV and return list of row dicts. Empty list on error."""
        path = self.csv_path(month)
        if not path.exists():
            return []
        try:
            with path.open(newline="", encoding=CSV_ENCODING) as f:
                return list(csv.DictReader(f))
        except Exception as exc:
            log.error("CSV read failed for %s: %s", month, exc)
            return []

    # ── List available months ─────────────────────────────────────────────────
    def available_months(self) -> List[str]:
        """Return sorted list of months that have a CSV (excluding backups)."""
        months = [
            p.stem for p in self.report_dir.glob("*.csv")
            if BACKUP_SUFFIX not in p.stem
        ]
        return sorted(months, reverse=True)