"""
models.py — Pure data classes (no I/O, no UI logic).
All domain objects live here for easy migration to any storage backend.
"""

from __future__ import annotations
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


def _new_id() -> str:
    return str(uuid.uuid4())[:8]


@dataclass
class User:
    name:  str
    email: str = ""
    id:    str = field(default_factory=_new_id)

    # ── serialisation ─────────────────────────────────────────────────────────
    def to_dict(self) -> dict:
        return {"id": self.id, "name": self.name, "email": self.email}

    @classmethod
    def from_dict(cls, d: dict) -> "User":
        return cls(id=d.get("id", _new_id()), name=d["name"], email=d.get("email", ""))

    def __str__(self) -> str:
        return self.name


@dataclass
class Item:
    user_id:  str
    item:     str
    price:    float
    month:    str                           # "YYYY-MM"
    added_at: str = field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))
    id:       str = field(default_factory=_new_id)

    # ── serialisation ─────────────────────────────────────────────────────────
    def to_dict(self) -> dict:
        return {
            "id":       self.id,
            "user_id":  self.user_id,
            "item":     self.item,
            "price":    self.price,
            "month":    self.month,
            "added_at": self.added_at,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "Item":
        return cls(
            id=d.get("id", _new_id()),
            user_id=d["user_id"],
            item=d["item"],
            price=float(d["price"]),
            month=d.get("month", datetime.now().strftime("%Y-%m")),
            added_at=d.get("added_at", datetime.now().isoformat(timespec="seconds")),
        )


@dataclass
class EmailSettings:
    smtp_host:       str  = "smtp.gmail.com"
    smtp_port:       int  = 587
    sender_email:    str  = ""
    sender_password: str  = ""
    use_tls:         bool = True

    def to_dict(self) -> dict:
        return {
            "smtp_host":       self.smtp_host,
            "smtp_port":       self.smtp_port,
            "sender_email":    self.sender_email,
            "sender_password": self.sender_password,
            "use_tls":         self.use_tls,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "EmailSettings":
        return cls(
            smtp_host=d.get("smtp_host", "smtp.gmail.com"),
            smtp_port=int(d.get("smtp_port", 587)),
            sender_email=d.get("sender_email", ""),
            sender_password=d.get("sender_password", ""),
            use_tls=bool(d.get("use_tls", True)),
        )