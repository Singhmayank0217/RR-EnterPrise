from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # MongoDB settings
    MONGODB_URL: str = "mongodb+srv://user:pass@cluster.mongodb.net/rr_enterprise?retryWrites=true&w=majority"
    DB_NAME: str = "rr_enterprise"
    
    # JWT settings
    SECRET_KEY: str = "9a7b3c2d1e5f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200  # 30 days for convenience in dev
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,https://rrep.vercel.app"
    CORS_ORIGIN_REGEX: str = r"https://.*\.vercel\.app"

    def get_cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]
    
    class Config:
        env_file = ".env"

settings = Settings()
