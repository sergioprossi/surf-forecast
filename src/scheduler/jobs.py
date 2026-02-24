"""APScheduler jobs for periodic data collection and scoring."""

from __future__ import annotations

import logging

from src.models.database import async_session

logger = logging.getLogger(__name__)


async def collect_and_score() -> None:
    """Main scheduled job: fetch fresh data and rescore all spots."""
    from src.collectors.open_meteo import collect_open_meteo
    from src.collectors.tides import collect_tides
    from src.engine.scoring import score_all_spots

    async with async_session() as session:
        try:
            n_meteo = await collect_open_meteo(session)
            logger.info("Scheduled collect: Open-Meteo %d rows", n_meteo)
        except Exception:
            logger.exception("Open-Meteo collection failed")

        try:
            n_tides = await collect_tides(session)
            logger.info("Scheduled collect: Tides %d rows", n_tides)
        except Exception:
            logger.exception("Tide collection failed")

        try:
            scored = await score_all_spots(session)
            logger.info("Scheduled scoring: %d time slots scored", len(scored))
        except Exception:
            logger.exception("Scoring failed")


async def evaluate_alerts() -> None:
    """Check scored forecasts against alert thresholds and send notifications."""
    from datetime import datetime, timezone

    from sqlalchemy import select

    from src.models.orm import AlertConfig, AlertLog, ScoredForecast

    async with async_session() as session:
        # Get enabled alert configs
        result = await session.execute(
            select(AlertConfig).where(AlertConfig.enabled == True)
        )
        configs = result.scalars().all()

        now = datetime.now(timezone.utc)

        for config in configs:
            # Check quiet hours
            if config.quiet_start_hour > config.quiet_end_hour:
                # Wraps midnight (e.g. 22-6)
                in_quiet = now.hour >= config.quiet_start_hour or now.hour < config.quiet_end_hour
            else:
                in_quiet = config.quiet_start_hour <= now.hour < config.quiet_end_hour

            if in_quiet:
                continue

            spot_ids = config.spot_ids.split(",")

            for spot_id in spot_ids:
                # Find recent high-scoring forecasts not yet alerted
                stmt = (
                    select(ScoredForecast)
                    .where(ScoredForecast.spot_id == spot_id)
                    .where(ScoredForecast.total_score >= config.min_score)
                    .where(ScoredForecast.forecast_time >= now)
                    .order_by(ScoredForecast.forecast_time)
                    .limit(5)
                )
                result = await session.execute(stmt)
                forecasts = result.scalars().all()

                for fc in forecasts:
                    # Dedup check
                    dedup_stmt = (
                        select(AlertLog)
                        .where(AlertLog.alert_config_id == config.id)
                        .where(AlertLog.spot_id == spot_id)
                        .where(AlertLog.forecast_time == fc.forecast_time)
                    )
                    dedup = await session.execute(dedup_stmt)
                    if dedup.scalar_one_or_none():
                        continue  # already sent

                    # Send alert
                    try:
                        await _send_alert(config, spot_id, fc)

                        # Log it
                        log = AlertLog(
                            alert_config_id=config.id,
                            spot_id=spot_id,
                            forecast_time=fc.forecast_time,
                            score=fc.total_score,
                        )
                        session.add(log)
                        await session.commit()
                    except Exception:
                        logger.exception(
                            "Failed to send alert for %s @ %s",
                            spot_id,
                            fc.forecast_time,
                        )


async def _send_alert(config: AlertConfig, spot_id: str, fc: ScoredForecast) -> None:
    """Dispatch an alert via the configured channel."""
    from src.config import SPOTS

    spot_name = SPOTS.get(spot_id, {}).get("name", spot_id)
    message = (
        f"🏄 {spot_name}: {fc.total_score}/10 ({fc.summary})\n"
        f"📅 {fc.forecast_time.strftime('%a %H:%M')}"
    )

    if config.channel == "telegram":
        from src.notifications.telegram import send_telegram_alert

        await send_telegram_alert(config.chat_id, message, spot_id, fc.forecast_time)
    elif config.channel == "email":
        from src.notifications.email import send_email_alert

        await send_email_alert(config.email, spot_name, message)
