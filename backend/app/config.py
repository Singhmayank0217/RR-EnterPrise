from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # MongoDB settings
    MONGODB_URL: str = "mongodb+srv://user:pass@cluster.mongodb.net/rr_enterprise?retryWrites=true&w=majority"
    DB_NAME: str = "rr_enterprise"
    
    # JWT settings
    SECRET_KEY: str = "9a7b3c2d1e5f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200  # 30 days for convenience in dev
    
    class Config:
        env_file = ".env"

settings = Settings()
