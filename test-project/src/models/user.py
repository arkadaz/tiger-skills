import uuid
from datetime import datetime, timezone
from enum import Enum


class RegistrationErrorType(Enum):
    DUPLICATE_EMAIL = "duplicate_email"
    VALIDATION_FAILED = "validation_failed"


class RegistrationError(Exception):
    def __init__(self, error_type: RegistrationErrorType, message: str) -> None:
        self.error_type = error_type
        self.message = message
        super().__init__(message)


class User:
    def __init__(self, name: str, email: str, password_hash: str, user_id: str | None = None) -> None:
        self.id = user_id or str(uuid.uuid4())
        self.name = name
        self.email = email
        self.password_hash = password_hash
        self.created_at = datetime.now(timezone.utc)
