"""Telegram bot for surf alerts with inline feedback buttons.

Sends alerts when conditions meet thresholds and provides
quick feedback buttons (1-5 stars) for session logging.
"""

from __future__ import annotations

import logging
from datetime import datetime

from src.config import settings

logger = logging.getLogger(__name__)


async def send_telegram_alert(
    chat_id: str | None,
    message: str,
    spot_id: str,
    forecast_time: datetime,
) -> bool:
    """Send a Telegram alert with inline feedback buttons.

    Returns True if sent successfully.
    """
    token = settings.telegram_bot_token
    target = chat_id or settings.telegram_chat_id

    if not token or not target:
        logger.warning("Telegram: not configured (missing token or chat_id)")
        return False

    try:
        from telegram import Bot, InlineKeyboardButton, InlineKeyboardMarkup

        bot = Bot(token=token)

        # Feedback buttons: rate the session 1-5 stars
        time_str = forecast_time.strftime("%Y%m%d%H")
        keyboard = InlineKeyboardMarkup(
            [
                [
                    InlineKeyboardButton(
                        f"{'⭐' * i}",
                        callback_data=f"rate:{spot_id}:{time_str}:{i}",
                    )
                    for i in range(1, 6)
                ]
            ]
        )

        await bot.send_message(
            chat_id=target,
            text=message,
            reply_markup=keyboard,
            parse_mode="HTML",
        )

        logger.info("Telegram alert sent to %s: %s", target, spot_id)
        return True

    except Exception:
        logger.exception("Telegram send failed")
        return False


async def send_telegram_message(chat_id: str | None, text: str) -> bool:
    """Send a plain text Telegram message (no buttons)."""
    token = settings.telegram_bot_token
    target = chat_id or settings.telegram_chat_id

    if not token or not target:
        return False

    try:
        from telegram import Bot

        bot = Bot(token=token)
        await bot.send_message(chat_id=target, text=text)
        return True
    except Exception:
        logger.exception("Telegram send failed")
        return False
