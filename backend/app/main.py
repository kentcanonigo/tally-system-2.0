from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .api.routes import customers, plants, weight_classifications, tally_sessions, allocation_details

app = FastAPI(
    title="Tally System API",
    description="Backend API for Tally System - Chicken Parts Inventory Management",
    version="2.0.0",
    debug=settings.debug
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://happy-rock-0067eee00.3.azurestaticapps.net",  # Your Static Web App URL
        "http://localhost:3000",  # For local development
    ],
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
    return {"status": "healthy"}

