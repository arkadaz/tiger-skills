# User Registration Endpoint

## What
Allow new users to register for the book store. Users provide name, email, and password. System validates input, hashes the password, stores the user, and returns the created user with a unique ID.

## Scope
- In: POST endpoint accepting name/email/password, Pydantic validation, password hashing, database persistence, structured response
- Out: Login (separate feature), email verification (separate feature), OAuth (separate feature)

## Input/Output
- Input: `RegisterRequest` — name (str, 1-100 chars), email (valid email), password (str, min 8 chars, must contain letter + digit)
- Output: `UserResponse` — id (str UUID), name, email, created_at (ISO datetime)

## Design
Classes:
- `RegisterRequest` (Pydantic BaseModel) — input validation with custom password validator
- `UserResponse` (Pydantic BaseModel) — output serialization
- `PasswordService` — hash password with bcrypt, verify password strength
- `UserService` — orchestrate registration (validate → hash → save → return)
- `UserRepository` (Protocol) — save user to database, check email uniqueness

Design patterns: Strategy (PasswordService is injectable), Code to Interface (UserRepository is a Protocol)

## Files to Touch
- src/api/auth.py — new: POST /api/auth/register endpoint
- src/services/auth_service.py — new: UserService with register() method
- src/services/password_service.py — new: PasswordService with hash() and validate_strength()
- src/repositories/user_repo.py — new: UserRepository Protocol + InMemoryUserRepository
- src/models/user.py — new: User domain model, UserRegistrationError

## Verification
- curl -X POST http://localhost:8000/api/auth/register -H 'Content-Type: application/json' -d '{"name":"Jane Doe","email":"jane@example.com","password":"secret123"}' | jq .id (expect UUID)
- curl -X POST ... -d '{"name":"","email":"bad","password":"short"}' | jq .status == 422 (validation)
- pytest tests/test_auth.py -x (unit tests)

## Dependencies
- bcrypt or passlib for password hashing
- Pydantic v2 for validation
- FastAPI for HTTP
