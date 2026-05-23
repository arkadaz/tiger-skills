# Codebase Map
Last updated: 2026-05-24 — F01 user registration

## Directory Overview
```
src/
├── api/          — FastAPI route handlers + request/response Pydantic models
│   └── auth.py   — POST /api/auth/register (RegisterRequest → UserResponse)
├── services/     — Business logic, use cases
│   ├── auth_service.py      — UserService: register() orchestration
│   └── password_service.py  — PasswordService: hash() + validate_strength()
├── repositories/ — Data access
│   └── user_repo.py — UserRepository (Protocol), InMemoryUserRepository
├── models/       — Domain types, enums
│   └── user.py   — User, RegistrationErrorType (Enum), RegistrationError
└── main.py       — (not yet created — FastAPI app factory)
```

## Key Files (by domain)
### Auth
- src/api/auth.py — POST /api/auth/register, RegisterRequest, UserResponse, DI wiring
- src/services/auth_service.py — UserService.register(name, email, password) → User
- src/services/password_service.py — PasswordService.hash(), validate_strength()
- src/repositories/user_repo.py — InMemoryUserRepository.save(), find_by_email()
- src/models/user.py — User domain model, RegistrationErrorType enum
- docs/business/auth.md — Password rules, email uniqueness, hashing policy

## Cross-Cutting Concerns
- Logging: All modules use logging.getLogger(__name__) — no print()
- Types: All I/O uses Pydantic (RegisterRequest, UserResponse) — no dict/Any
- DI: UserService receives UserRepository + PasswordService via constructor

## External Dependencies
- FastAPI — HTTP framework
- Pydantic v2 — validation + serialization
- (Future: SQLAlchemy 2.0 + PostgreSQL)
