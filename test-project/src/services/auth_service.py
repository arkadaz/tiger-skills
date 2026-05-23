import logging

from src.models.user import RegistrationError, RegistrationErrorType, User
from src.repositories.user_repo import UserRepository
from src.services.password_service import PasswordService

logger = logging.getLogger(__name__)


class UserService:
    def __init__(self, repo: UserRepository, password_service: PasswordService) -> None:
        self._repo = repo
        self._password_service = password_service

    def register(self, name: str, email: str, password: str) -> User:
        logger.info("Registering user", extra={"email": email})

        strength = self._password_service.validate_strength(password)
        if not strength.is_valid:
            logger.warning("Weak password rejected", extra={"email": email})
            raise RegistrationError(
                RegistrationErrorType.VALIDATION_FAILED,
                strength.error_message,
            )

        password_hash = self._password_service.hash(password)
        user = User(name=name, email=email, password_hash=password_hash)

        saved_user = self._repo.save(user)
        logger.info("User registered", extra={"user_id": saved_user.id})
        return saved_user
