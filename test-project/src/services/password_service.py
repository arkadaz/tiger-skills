import hashlib
import logging
import re
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PasswordValidationResult:
    is_valid: bool
    error_message: str = ""


class PasswordService:
    _MIN_LENGTH = 8
    _LETTER_DIGIT_PATTERN = re.compile(r"^(?=.*[a-zA-Z])(?=.*\d)")

    def hash(self, password: str) -> str:
        logger.debug("Hashing password")
        return hashlib.sha256(password.encode()).hexdigest()

    def validate_strength(self, password: str) -> PasswordValidationResult:
        if len(password) < self._MIN_LENGTH:
            return PasswordValidationResult(
                is_valid=False,
                error_message=f"Password must be at least {self._MIN_LENGTH} characters",
            )
        if not self._LETTER_DIGIT_PATTERN.match(password):
            return PasswordValidationResult(
                is_valid=False,
                error_message="Password must contain at least one letter and one digit",
            )
        return PasswordValidationResult(is_valid=True)
