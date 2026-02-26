"""FastAPI application — surf forecast API for Porto coast."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import settings
from src.models.database import init_db
from src.scheduler.jobs import collect_and_score, evaluate_alerts

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB + start scheduler. Shutdown: stop scheduler."""
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

    await init_db()
    logger.info("Database initialized")

    # Schedule periodic data collection + scoring
    scheduler.add_job(
        collect_and_score,
        trigger=IntervalTrigger(minutes=settings.scheduler_interval_minutes),
        id="collect_and_score",
        replace_existing=True,
    )
    scheduler.add_job(
        evaluate_alerts,
        trigger=IntervalTrigger(minutes=15),
        id="evaluate_alerts",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Scheduler started (collection every %d min)", settings.scheduler_interval_minutes)

    yield

    scheduler.shutdown()
    logger.info("Scheduler stopped")


app = FastAPI(
    title="Porto Surf Forecast",
    description="Smart surf forecast for Porto coast — scores wave quality per spot",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS — allow mobile app and local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: restrict to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
from src.api.auth import router as auth_router
from src.api.routes.alerts import router as alerts_router
from src.api.routes.feedback import router as feedback_router
from src.api.routes.forecast import router as forecast_router
from src.api.routes.spots import router as spots_router

app.include_router(auth_router)
app.include_router(spots_router)
app.include_router(forecast_router)
app.include_router(alerts_router)
app.include_router(feedback_router)


@app.get("/")
async def root():
    return {
        "name": "Porto Surf Forecast",
        "version": "0.1.0",
        "docs": "/docs",
        "spots": "/api/v1/spots",
    }
