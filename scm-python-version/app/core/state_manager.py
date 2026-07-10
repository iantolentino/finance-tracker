"""
core/state_manager.py — Persistent JSON state CRUD.

Responsibilities:
  - Load / save state.json
  - Expose typed accessors for users, items, email settings
  - Auto-create missing directories / files
  - Never raise — log errors and return safe defaults
"""

from __future__ import annotations
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from app.config import STATE_FILE, DATA_DIR, REPORT_DIR, DEFAULT_STATE
from app.models import User, Item, EmailSettings

log = logging.getLogger(__name__)


class StateManager:
    """Single source of truth for in-memory app state; persists to JSON."""

    def __init__(self) -> None:
        self._users:   List[User]          = []
        self._items:   List[Item]          = []
        self._email:   EmailSettings       = EmailSettings()
        self._dirty:   bool                = False
        self._ensure_dirs()
        self.load()

    # ── Dir setup ─────────────────────────────────────────────────────────────
    def _ensure_dirs(self) -> None:
        for d in (DATA_DIR, REPORT_DIR):
            d.mkdir(parents=True, exist_ok=True)

    # ── Load / Save ───────────────────────────────────────────────────────────
    def load(self) -> None:
        """Load state from disk; silently fall back to defaults on any error."""
        try:
            if STATE_FILE.exists():
                raw = json.loads(STATE_FILE.read_text(encoding="utf-8"))
            else:
                raw = DEFAULT_STATE.copy()

            self._users = [User.from_dict(u) for u in raw.get("users", [])]
            self._items = [Item.from_dict(i) for i in raw.get("items", [])]
            self._email = EmailSettings.from_dict(raw.get("email_settings", {}))
            log.info("State loaded — %d users, %d items", len(self._users), len(self._items))
        except Exception as exc:
            log.error("Failed to load state (%s); using defaults.", exc)
            self._users, self._items, self._email = [], [], EmailSettings()

    def save(self) -> bool:
        """Persist current state to disk. Returns True on success."""
        try:
            payload = {
                "users":         [u.to_dict() for u in self._users],
                "items":         [i.to_dict() for i in self._items],
                "email_settings": self._email.to_dict(),
                "meta": {
                    "version":    "1.0.0",
                    "last_saved": datetime.now().isoformat(timespec="seconds"),
                },
            }
            tmp = STATE_FILE.with_suffix(".tmp")
            tmp.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            tmp.replace(STATE_FILE)          # atomic on same filesystem
            self._dirty = False
            log.info("State saved.")
            return True
        except Exception as exc:
            log.error("Failed to save state: %s", exc)
            return False

    # ── User CRUD ─────────────────────────────────────────────────────────────
    @property
    def users(self) -> List[User]:
        return list(self._users)

    def get_user(self, user_id: str) -> Optional[User]:
        return next((u for u in self._users if u.id == user_id), None)

    def add_user(self, name: str, email: str = "") -> User:
        name = name.strip()
        if not name:
            raise ValueError("User name cannot be empty.")
        if any(u.name.lower() == name.lower() for u in self._users):
            raise ValueError(f"User '{name}' already exists.")
        user = User(name=name, email=email.strip())
        self._users.append(user)
        self._dirty = True
        self.save()
        return user

    def remove_user(self, user_id: str) -> bool:
        before = len(self._users)
        self._users = [u for u in self._users if u.id != user_id]
        # remove items belonging to that user too
        self._items = [i for i in self._items if i.user_id != user_id]
        if len(self._users) < before:
            self._dirty = True
            self.save()
            return True
        return False

    # ── Item CRUD ─────────────────────────────────────────────────────────────
    @property
    def items(self) -> List[Item]:
        return list(self._items)

    def items_for_user(self, user_id: str, month: Optional[str] = None) -> List[Item]:
        result = [i for i in self._items if i.user_id == user_id]
        if month:
            result = [i for i in result if i.month == month]
        return result

    def items_for_month(self, month: str) -> List[Item]:
        return [i for i in self._items if i.month == month]

    def add_item(self, user_id: str, item_name: str, price: float, month: str) -> Item:
        item_name = item_name.strip()
        if not item_name:
            raise ValueError("Item name cannot be empty.")
        if price < 0:
            raise ValueError("Price cannot be negative.")
        item = Item(user_id=user_id, item=item_name, price=round(price, 2), month=month)
        self._items.append(item)
        self._dirty = True
        self.save()
        return item

    def remove_item(self, item_id: str) -> bool:
        before = len(self._items)
        self._items = [i for i in self._items if i.id != item_id]
        if len(self._items) < before:
            self._dirty = True
            self.save()
            return True
        return False

    # ── Email settings ────────────────────────────────────────────────────────
    @property
    def email_settings(self) -> EmailSettings:
        return self._email

    def update_email_settings(self, **kwargs) -> None:
        for k, v in kwargs.items():
            if hasattr(self._email, k):
                setattr(self._email, k, v)
        self._dirty = True
        self.save()

    # ── Helpers ───────────────────────────────────────────────────────────────
    def total_for_user(self, user_id: str, month: str) -> float:
        return sum(i.price for i in self.items_for_user(user_id, month))

    def all_months(self) -> List[str]:
        """Return sorted list of all months that have items."""
        return sorted({i.month for i in self._items}, reverse=True)