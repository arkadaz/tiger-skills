# Code Flow Graph
Last updated: 2026-05-24 — F01 user registration

## Entry Points
- POST /api/auth/register — Register a new user

## User Registration Flow
```
POST /api/auth/register
  → src/api/auth.py:register()                  [Pydantic validates RegisterRequest]
    → src/services/auth_service.py:register()    [orchestrate registration]
      → src/services/password_service.py:validate_strength()  [check min 8 chars, letter+digit]
        → src/models/user.py:RegistrationError(VALIDATION_FAILED)  [if weak — caught by api layer → 422]
      → src/services/password_service.py:hash()  [SHA-256 hash]
      → src/repositories/user_repo.py:save()     [check email uniqueness, store in memory]
        → src/models/user.py:RegistrationError(DUPLICATE_EMAIL)   [if duplicate — caught by api layer → 409]
      → src/models/user.py:User                   [new user with UUID, timestamp]
    → src/api/auth.py:UserResponse               [Pydantic serialization → 201]
```

## Key Decision Points
- **Password validation** (src/api/auth.py RegisterRequest validator + src/services/password_service.py:validate_strength)
  - Pydantic level: min 8 chars (Field), letter+digit check (field_validator)
  - Service level: additional strength rules can be added independently
- **Duplicate email** (src/repositories/user_repo.py:save)
  - Email exists → raise RegistrationError(DUPLICATE_EMAIL) → API returns 409
  - Email new → save, return User

## Data Transformations
```
RegisterRequest (Pydantic, from HTTP body)
  → User(name, email, password_hash, id=UUID, created_at=now) (domain model)
    → UserResponse(id, name, email, created_at) (Pydantic, to HTTP response)
```

## External Calls
- None (in-memory storage — PostgreSQL implementation via UserRepository Protocol later)

## Error Propagation
- Pydantic ValidationError → FastAPI auto-returns 422
- RegistrationError(DUPLICATE_EMAIL) → api layer catches → HTTP 409
- RegistrationError(VALIDATION_FAILED) → api layer catches → HTTP 422
