"""
email_module/sender.py — SMTP email dispatch.

Uses only stdlib: smtplib + email.  Gmail-compatible with App Passwords.
Never raises — returns (success: bool, message: str).
"""

from __future__ import annotations
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.base import MIMEBase
from email import encoders
from pathlib import Path
from typing import Optional, Tuple

from app.config import EMAIL_TIMEOUT
from app.models import EmailSettings

log = logging.getLogger(__name__)


def send_snapshot(
    settings: EmailSettings,
    recipient_email: str,
    recipient_name: str,
    subject: str,
    html_body: str,
    plain_body: str,
    attachment: Optional[Path] = None,
) -> Tuple[bool, str]:
    """
    Send an email snapshot.

    Returns:
        (True, "Sent successfully")  on success
        (False, "<error message>")   on any failure
    """
    if not settings.sender_email or not settings.sender_password:
        return False, "Email credentials not configured. Check Settings."

    if not recipient_email:
        return False, "Recipient has no email address."

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"Spaylater Manager <{settings.sender_email}>"
        msg["To"]      = recipient_email

        # Attach plain + HTML parts (HTML preferred by clients)
        msg.attach(MIMEText(plain_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body,  "html",  "utf-8"))

        # Optionally attach CSV
        if attachment and attachment.exists():
            with attachment.open("rb") as f:
                part = MIMEBase("application", "octet-stream")
                part.set_payload(f.read())
            encoders.encode_base64(part)
            part.add_header(
                "Content-Disposition",
                f'attachment; filename="{attachment.name}"',
            )
            msg.attach(part)

        # Connect and send
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=EMAIL_TIMEOUT) as server:
            if settings.use_tls:
                server.starttls()
            server.login(settings.sender_email, settings.sender_password)
            server.sendmail(settings.sender_email, recipient_email, msg.as_string())

        log.info("Email sent to %s", recipient_email)
        return True, f"Email sent successfully to {recipient_email}"

    except smtplib.SMTPAuthenticationError:
        msg = "Authentication failed. Check your email/password or use a Gmail App Password."
        log.error(msg)
        return False, msg
    except smtplib.SMTPConnectError:
        msg = f"Cannot connect to {settings.smtp_host}:{settings.smtp_port}. Check host/port."
        log.error(msg)
        return False, msg
    except TimeoutError:
        msg = f"Connection timed out after {EMAIL_TIMEOUT}s."
        log.error(msg)
        return False, msg
    except Exception as exc:
        msg = f"Email error: {exc}"
        log.error(msg)
        return False, msg