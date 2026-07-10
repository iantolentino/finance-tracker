"""
ui/settings_panel.py — Email / SMTP settings panel.

Lets the admin configure sender credentials.
Includes a test-send button and inline guidance for Gmail App Passwords.
"""

from __future__ import annotations
import tkinter as tk
from tkinter import ttk, messagebox

from app.config import THEME
from app.models import EmailSettings
from app.email_module.sender import send_snapshot
from app.ui.widgets import BasePanel


class SettingsPanel(BasePanel):

    def __init__(self, parent: tk.Widget, app) -> None:
        super().__init__(parent, app)
        self._build()

    def _build(self) -> None:
        T = THEME
        main = self.frame

        # ── Title bar ─────────────────────────────────────────────────────────
        title_bar = tk.Frame(main, bg=T["bg_panel"], pady=16, padx=24)
        title_bar.pack(fill=tk.X)
        tk.Label(title_bar, text="Settings", bg=T["bg_panel"],
                 fg=T["text"], font=("Georgia", 18, "bold")).pack(side=tk.LEFT)

        # ── Scrollable body ───────────────────────────────────────────────────
        body = tk.Frame(main, bg=T["bg"])
        body.pack(fill=tk.BOTH, expand=True, padx=24, pady=16)

        left = tk.Frame(body, bg=T["bg"], width=400)
        left.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 32))
        left.pack_propagate(False)
        self._build_email_form(left)

        right = tk.Frame(body, bg=T["bg"], width=340)
        right.pack(side=tk.LEFT, fill=tk.Y)
        right.pack_propagate(False)
        self._build_guide(right)

    def _build_email_form(self, parent: tk.Widget) -> None:
        T = THEME
        self.section_header(parent, "Email / SMTP Configuration")

        s = self.state.email_settings

        self._smtp_host_var  = tk.StringVar(value=s.smtp_host)
        self._smtp_port_var  = tk.StringVar(value=str(s.smtp_port))
        self._sender_var     = tk.StringVar(value=s.sender_email)
        self._password_var   = tk.StringVar(value=s.sender_password)
        self._tls_var        = tk.BooleanVar(value=s.use_tls)

        self.labeled_entry(parent, "SMTP Host",  self._smtp_host_var)
        self.labeled_entry(parent, "SMTP Port",  self._smtp_port_var, width=8)

        # Sender email
        self.labeled_entry(parent, "Sender Email", self._sender_var)

        # Password (masked)
        T = THEME
        f = tk.Frame(parent, bg=T["bg"])
        tk.Label(f, text="App Password / SMTP Password", bg=T["bg"],
                 fg=T["text_muted"], font=("Courier New", 9)).pack(anchor="w")
        pw_row = tk.Frame(f, bg=T["bg"])
        pw_row.pack(fill=tk.X)
        self._pw_entry = ttk.Entry(pw_row, textvariable=self._password_var,
                                   show="•", width=28)
        self._pw_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=4)
        self._show_pw = False
        eye_btn = tk.Button(pw_row, text="👁", bg=T["bg_card"], fg=T["text_muted"],
                            bd=0, padx=6, cursor="hand2",
                            command=self._toggle_password)
        eye_btn.pack(side=tk.LEFT, padx=(4, 0))
        f.pack(fill=tk.X, pady=4)

        # TLS checkbox
        chk = tk.Checkbutton(
            parent,
            text="Use TLS (recommended)",
            variable=self._tls_var,
            bg=T["bg"], fg=T["text"],
            selectcolor=T["bg_card"],
            activebackground=T["bg"],
            activeforeground=T["accent"],
            font=("Courier New", 10),
        )
        chk.pack(anchor="w", pady=6)

        self.separator(parent)

        # Buttons row
        btn_row = tk.Frame(parent, bg=T["bg"])
        btn_row.pack(fill=tk.X)
        self.btn(btn_row, "💾  Save Settings", self._save_settings, accent=True).pack(
            side=tk.LEFT, padx=(0, 8))
        self.btn(btn_row, "✉  Send Test Email", self._test_email).pack(side=tk.LEFT)

        self._feedback = tk.Label(parent, text="", bg=T["bg"], fg=T["success"],
                                   font=("Courier New", 9), wraplength=360, justify=tk.LEFT)
        self._feedback.pack(anchor="w", pady=(8, 0))

    def _build_guide(self, parent: tk.Widget) -> None:
        T = THEME
        self.section_header(parent, "Setup Guide")

        steps = [
            ("Gmail App Password", (
                "1. Go to myaccount.google.com\n"
                "2. Security → 2-Step Verification (enable)\n"
                "3. Security → App Passwords\n"
                "4. Create password for 'Mail'\n"
                "5. Paste the 16-char code above"
            )),
            ("Gmail SMTP Settings", (
                "Host : smtp.gmail.com\n"
                "Port : 587\n"
                "TLS  : ✓ Yes"
            )),
            ("Other Providers", (
                "Outlook : smtp-mail.outlook.com:587\n"
                "Yahoo   : smtp.mail.yahoo.com:587\n"
                "Custom  : Check your provider docs"
            )),
        ]

        for title, body in steps:
            card = self.card(parent)
            card.pack(fill=tk.X, pady=6)
            tk.Label(card, text=title, bg=T["bg_card"],
                     fg=T["accent"], font=("Courier New", 10, "bold")).pack(anchor="w")
            tk.Label(card, text=body, bg=T["bg_card"],
                     fg=T["text_muted"], font=("Courier New", 9),
                     justify=tk.LEFT).pack(anchor="w", pady=(4, 0))

    # ── Actions ───────────────────────────────────────────────────────────────
    def refresh(self) -> None:
        s = self.state.email_settings
        self._smtp_host_var.set(s.smtp_host)
        self._smtp_port_var.set(str(s.smtp_port))
        self._sender_var.set(s.sender_email)
        self._password_var.set(s.sender_password)
        self._tls_var.set(s.use_tls)

    def _toggle_password(self) -> None:
        self._show_pw = not self._show_pw
        self._pw_entry.configure(show="" if self._show_pw else "•")

    def _save_settings(self) -> None:
        try:
            port = int(self._smtp_port_var.get().strip())
        except ValueError:
            self._show_feedback("Port must be a number (e.g. 587).", error=True)
            return

        self.state.update_email_settings(
            smtp_host=self._smtp_host_var.get().strip(),
            smtp_port=port,
            sender_email=self._sender_var.get().strip(),
            sender_password=self._password_var.get().strip(),
            use_tls=self._tls_var.get(),
        )
        self._show_feedback("Settings saved.", error=False)
        self.app.set_status("Email settings saved.")

    def _test_email(self) -> None:
        settings = self.state.email_settings
        if not settings.sender_email:
            self._show_feedback("Enter sender email first.", error=True)
            return

        # Send test to self
        self._show_feedback("Sending test email…")
        self.frame.update_idletasks()

        ok, msg = send_snapshot(
            settings=settings,
            recipient_email=settings.sender_email,
            recipient_name="Admin",
            subject="Spaylater — Test Email",
            html_body="<p>✓ Spaylater email is configured correctly.</p>",
            plain_body="✓ Spaylater email is configured correctly.",
            attachment=None,
        )
        self._show_feedback(msg, error=not ok)
        self.app.set_status(msg, error=not ok)

    def _show_feedback(self, msg: str, error: bool = False) -> None:
        T = THEME
        self._feedback.configure(text=msg, fg=T["danger"] if error else T["success"])
        self.frame.after(6000, lambda: self._feedback.configure(text=""))