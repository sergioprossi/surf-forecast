"""Manual data collection script — run to populate the database.

Usage:
    python -m scripts.collect_data [--source open_meteo|tides|stormglass|bathymetry|all]
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


async def main(source: str) -> None:
    from src.models.database import init_db, async_session

    await init_db()

    async with async_session() as session:
        if source in ("open_meteo", "all"):
            from src.collectors.open_meteo import collect_open_meteo

            n = await collect_open_meteo(session)
            print(f"Open-Meteo: {n} rows collected")

        if source in ("tides", "all"):
            from src.collectors.tides import collect_tides

            n = await collect_tides(session)
            print(f"Tides: {n} predictions generated")

        if source in ("stormglass", "all"):
            from src.collectors.stormglass import collect_stormglass

            n = await collect_stormglass(session)
            print(f"Stormglass: {n} rows collected")

        if source in ("bathymetry", "all"):
            from src.collectors.emodnet import collect_bathymetry

            n = await collect_bathymetry()
            print(f"Bathymetry: {n} spot profiles saved")

        if source in ("cmems", "all"):
            from src.collectors.cmems import collect_cmems

            n = await collect_cmems(session)
            print(f"CMEMS: {n} rows collected")

    if source == "score":
        from src.engine.scoring import score_all_spots

        async with async_session() as session:
            scored = await score_all_spots(session)
            print(f"Scored: {len(scored)} time slots")
            best = sorted(scored, key=lambda s: s.total_score, reverse=True)[:5]
            for s in best:
                print(f"  {s.spot_id} @ {s.forecast_time}: {s.total_score}/10 — {s.summary}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Collect surf forecast data")
    parser.add_argument(
        "--source",
        choices=["open_meteo", "tides", "stormglass", "bathymetry", "cmems", "score", "all"],
        default="all",
    )
    args = parser.parse_args()
    asyncio.run(main(args.source))
