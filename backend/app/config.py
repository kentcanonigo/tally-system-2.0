from pydantic_settings import BaseSettings
from typing import Optional, List


class Settings(BaseSettings):
    database_url: str = "sqlite:///./tally_system.db"
    api_v1_prefix: str = "/api/v1"
    debug: bool = True
    cors_origins: str = "*"  # Comma-separated list of origins, or "*" for all
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    def get_cors_origins(self) -> List[str]:
        """Parse CORS origins from environment variable."""
        if self.cors_origins == "*" or not self.cors_origins:
            return ["*"]  # Allow all origins
        # Split by comma and strip whitespace
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()

