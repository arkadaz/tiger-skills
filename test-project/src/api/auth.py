import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator

from src.models.user import RegistrationError, RegistrationErrorType
from src.repositories.user_repo import InMemoryUserRepository, UserRepository
from src.services.auth_service import UserService
from src.services.password_service import PasswordService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    email: EmailStr
    password: str = Field(min_length=8)

    @field_validator("password")
    @classmethod
    def password_has_letter_and_digit(cls, v: str) -> str:
        has_letter = any(c.isalpha() for c in v)
        has_digit = any(c.isdigit() for c in v)
        if not has_letter or not has_digit:
            raise ValueError("Password must contain at least one letter and one digit")
        return v


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    created_at: str


_USER_REPO: InMemoryUserRepository | None = None
_PASSWORD_SERVICE: PasswordService | None = None
_USER_SERVICE: UserService | None = None


def _get_user_service() -> UserService:
    global _USER_REPO, _PASSWORD_SERVICE, _USER_SERVICE
    if _USER_SERVICE is None:
        _USER_REPO = InMemoryUserRepository()
        _PASSWORD_SERVICE = PasswordService()
        _USER_SERVICE = UserService(_USER_REPO, _PASSWORD_SERVICE)
    return _USER_SERVICE


@router.post("/register", response_model=UserResponse, status_code=201)
def register(
    request: RegisterRequest,
    service: Annotated[UserService, Depends(_get_user_service)],
) -> UserResponse:
    logger.info("Registration request received", extra={"email": request.email})
    try:
        user = service.register(
            name=request.name,
            email=request.email,
            password=request.password,
        )
    except RegistrationError as e:
        if e.error_type == RegistrationErrorType.DUPLICATE_EMAIL:
            raise HTTPException(status_code=409, detail=e.message) from e
        if e.error_type == RegistrationErrorType.VALIDATION_FAILED:
            raise HTTPException(status_code=422, detail=e.message) from e
        raise HTTPException(status_code=400, detail=e.message) from e

    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        created_at=user.created_at.isoformat(),
    )
