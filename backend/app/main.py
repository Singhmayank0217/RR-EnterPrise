from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .database import connect_to_mongo, close_mongo_connection
from .routers import auth, shipments, pricing, invoices, consignments, rate_cards


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Database connection lifecycle."""
    await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(
    title="RR Enterprise Logistics API",
    description="Delivery Tracking & Pricing Management System",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the Cloudflare Pages URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router)
app.include_router(shipments.router)
app.include_router(pricing.router)
app.include_router(invoices.router)
app.include_router(consignments.router)
app.include_router(rate_cards.router)


@app.get("/")
async def root():
    return {"message": "Welcome to RR Enterprise Logistics API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
