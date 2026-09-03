"""FastAPI aggregation service for the Oregon Fire & Air Dashboard.

The service owns fetching, normalizing, and caching the public feeds; this module wires
the health surface, the CORS boundary for the SPA origin, and the feed routes.
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.config import cors_origins, spa_dist_dir
from app.feeds import close_http_client
from app.routes import router


class HealthResponse(BaseModel):
    status: str


def create_app() -> FastAPI:
    """Build the app. A factory so env-driven settings are resolved per instance."""

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        yield
        await close_http_client()

    application = FastAPI(
        title="Oregon Fire & Air API",
        version="0.2.0",
        description="Aggregates public fire, weather, and air-quality feeds for the dashboard.",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    application.include_router(router)

    @application.get("/healthz", response_model=HealthResponse)
    async def healthz() -> HealthResponse:
        """Liveness probe used by hosting and CI."""
        return HealthResponse(status="ok")

    # Single-origin hosting: when SPA_DIST_DIR names a built frontend, one process
    # serves both tiers for the hosted preview. Mounted last so /api/* and /healthz
    # routes match before the static catch-all.
    spa_dir = spa_dist_dir()
    if spa_dir is not None:
        application.mount("/", StaticFiles(directory=spa_dir, html=True), name="spa")

    return application


app = create_app()
