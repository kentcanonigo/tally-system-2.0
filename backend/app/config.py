from pydantic_settings import BaseSettings
from typing import Optional, List
import secrets


class Settings(BaseSettings):
    database_url: str = "sqlite:///./tally_system.db"
    api_v1_prefix: str = "/api/v1"
    debug: bool = True
    cors_origins: str = "*"  # Comma-separated list of origins, or "*" for all
    
    # Authentication settings
    # IMPORTANT: SECRET_KEY should be set in .env file for production
    # If not set, a random key will be generated (NOT recommended for production)
    secret_key: Optional[str] = None
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480  # 8 hours
    
    class Config:
        env_file = ".env"
        case_sensitive = False
    
    def get_cors_origins(self) -> List[str]:
        """Parse CORS origins from environment variable."""
        if self.cors_origins == "*" or not self.cors_origins:
            return ["*"]  # Allow all origins
        # Split by comma and strip whitespace
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
    
    def model_post_init(self, __context):
        """Generate secret key if not provided."""
        if not self.secret_key:
            # Generate a random key only if not set in .env
            self.secret_key = secrets.token_urlsafe(32)
            print("WARNING: Using randomly generated SECRET_KEY. Set SECRET_KEY in .env for production!")


settings = Settings()

