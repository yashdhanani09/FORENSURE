from contextlib import asynccontextmanager
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import devices, system, sanitization, forensics, recovery
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.core.admin_check import require_admin_or_warn
from app.database.database import init_database


@asynccontextmanager
async def lifespan(_: FastAPI):
    configure_logging()
    init_database()
    require_admin_or_warn("Device detection (Get-Disk / Get-Partition)")
    logging.getLogger(__name__).info("securedata_api_started")
    yield
    logging.getLogger(__name__).info("securedata_api_stopped")


settings = get_settings()
app = FastAPI(
    title="SecureData USB API",
    version="0.1.0",
    description=(
        "Linux USB discovery API for the SecureData forensics and sanitization prototype. "
        "Phase 1 has no destructive endpoint."
    ),
    lifespan=lifespan,
)
cors_kwargs = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}
if "*" in settings.cors_origin_list:
    cors_kwargs["allow_origin_regex"] = r"^https?://.*"
else:
    cors_kwargs["allow_origins"] = settings.cors_origin_list

app.add_middleware(CORSMiddleware, **cors_kwargs)


@app.middleware("http")
async def add_private_network_access_header(request, call_next):
    response = await call_next(request)
    if request.headers.get("access-control-request-private-network"):
        response.headers["Access-Control-Allow-Private-Network"] = "true"
    return response
app.include_router(system.router, prefix=settings.api_prefix)
app.include_router(devices.router, prefix=settings.api_prefix)
app.include_router(sanitization.router, prefix=settings.api_prefix)
app.include_router(forensics.router, prefix=settings.api_prefix)
app.include_router(recovery.router, prefix=settings.api_prefix)


@app.get("/health", tags=["System"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}

