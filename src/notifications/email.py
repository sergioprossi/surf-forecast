"""Email alert sender — fallback notification channel.

Uses aiosmtplib for async email delivery.
"""

from __future__ import annotations

import logging
from email.message import EmailMessage

import aiosmtplib

from src.config import settings

logger = logging.getLogger(__name__)


async def send_email_alert(
    to_addr: str | None,
    spot_name: str,
    body: str,
) -> bool:
    """Send a surf alert email.

    Returns True if sent successfully.
    """
    to = to_addr or settings.email_to
    if not to or not settings.smtp_username:
        logger.warning("Email: not configured (missing SMTP credentials or recipient)")
        return False

    msg = EmailMessage()
    msg["Subject"] = f"Surf Alert: {spot_name}"
    msg["From"] = settings.email_from or settings.smtp_username
    msg["To"] = to
    msg.set_content(body)

    try:
        await aiosmtplib.send(
            msg,
            hostname=settings.smtp_host,
            port=settings.smtp_port,
            username=settings.smtp_username,
            password=settings.smtp_password,
            use_tls=False,
            start_tls=True,
        )
        logger.info("Email alert sent to %s: %s", to, spot_name)
        return True

    except Exception:
        logger.exception("Email send failed")
        return False
