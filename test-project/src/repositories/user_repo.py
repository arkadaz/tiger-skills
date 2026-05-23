import logging
from typing import Protocol

from src.models.user import RegistrationError, RegistrationErrorType, User

logger = logging.getLogger(__name__)


class UserRepository(Protocol):
    def save(self, user: User) -> User: ...

    def find_by_email(self, email: str) -> User | None: ...


class InMemoryUserRepository:
    def __init__(self) -> None:
        self._users: dict[str, User] = {}
        self._email_index: dict[str, str] = {}

    def save(self, user: User) -> User:
        existing_id = self._email_index.get(user.email.lower())
        if existing_id is not None:
            logger.warning("Duplicate email registration attempt", extra={"email": user.email})
            raise RegistrationError(
                RegistrationErrorType.DUPLICATE_EMAIL,
                f"Email '{user.email}' is already registered",
            )
        self._users[user.id] = user
        self._email_index[user.email.lower()] = user.id
        logger.info("User saved", extra={"user_id": user.id, "email": user.email})
        return user

    def find_by_email(self, email: str) -> User | None:
        user_id = self._email_index.get(email.lower())
        if user_id is None:
            return None
        return self._users.get(user_id)
