import logging
import traceback
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from .config import settings
from .api.routes import customers, plants, weight_classifications, tally_sessions, allocation_details

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Tally System API",
    description="Backend API for Tally System - Chicken Parts Inventory Management",
    version="2.0.0",
    debug=settings.debug
)

# CORS middleware
# Get allowed origins from settings (can be configured via CORS_ORIGINS env var)
# Defaults to "*" (allow all) if not set
cors_origins = settings.get_cors_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(customers.router, prefix=settings.api_v1_prefix, tags=["customers"])
app.include_router(plants.router, prefix=settings.api_v1_prefix, tags=["plants"])
app.include_router(weight_classifications.router, prefix=settings.api_v1_prefix, tags=["weight-classifications"])
app.include_router(tally_sessions.router, prefix=settings.api_v1_prefix, tags=["tally-sessions"])
app.include_router(allocation_details.router, prefix=settings.api_v1_prefix, tags=["allocation-details"])


@app.get("/")
async def root():
    return {"message": "Tally System API", "version": "2.0.0"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/health/db")
async def database_health_check():
    """Database health check endpoint."""
    from .database import engine
    from sqlalchemy import text
    try:
        # Try to connect to the database
        with engine.connect() as conn:
            # Try a simple query
            result = conn.execute(text("SELECT 1"))
            result.fetchone()
        return {
            "status": "healthy",
            "database": "connected",
            "database_url": settings.database_url.split("@")[-1].split("/")[0] if "@" in settings.database_url else "local"
        }
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}", exc_info=True)
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "database": "disconnected",
                "error": str(e),
                "type": type(e).__name__
            }
        )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler to catch all unhandled exceptions."""
    logger.error(
        f"Unhandled exception: {type(exc).__name__}: {str(exc)}",
        exc_info=True,
        extra={
            "path": request.url.path,
            "method": request.method,
            "traceback": traceback.format_exc()
        }
    )
    
    # In production, don't expose full traceback
    if settings.debug:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": str(exc),
                "type": type(exc).__name__,
                "traceback": traceback.format_exc()
            }
        )
    else:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": "Internal server error. Please check logs for details.",
                "type": type(exc).__name__
            }
        )


@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    """Handle database-related errors."""
    logger.error(
        f"Database error: {type(exc).__name__}: {str(exc)}",
        exc_info=True,
        extra={
            "path": request.url.path,
            "method": request.method
        }
    )
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Database error occurred. Please check database connection and configuration.",
            "type": type(exc).__name__,
            "error": str(exc) if settings.debug else "Database error"
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle request validation errors."""
    logger.warning(
        f"Validation error: {exc.errors()}",
        extra={
            "path": request.url.path,
            "method": request.method
        }
    )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": exc.errors(),
            "body": exc.body
        }
    )

