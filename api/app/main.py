"""FastAPI aggregation service for the Oregon Fire & Air Dashboard.

The service owns fetching, normalizing, and caching the public feeds (later PRs); the
scaffold ships the health surface and the CORS boundary for the SPA origin.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import cors_origins


class HealthResponse(BaseModel):
    status: str


def create_app() -> FastAPI:
    """Build the app. A factory so env-driven settings are resolved per instance."""
    application = FastAPI(
        title="Oregon Fire & Air API",
        version="0.1.0",
        description="Aggregates public fire, weather, and air-quality feeds for the dashboard.",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins(),
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.get("/healthz", response_model=HealthResponse)
    async def healthz() -> HealthResponse:
        """Liveness probe used by hosting and CI."""
        return HealthResponse(status="ok")

    return application


app = create_app()
