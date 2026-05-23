# Auth Business Rules

## User Registration

### Password Requirements
- Rule: Password must be at least 8 characters AND contain at least one letter AND at least one digit
- Reason: Basic security requirement — prevents trivial passwords like "12345678" or "password"
- Implemented: src/services/password_service.py:16 (validate_strength), src/api/auth.py:29 (field_validator)
- Last updated: 2026-05-24

### Email Uniqueness
- Rule: Email addresses are case-insensitive unique. "Jane@Example.com" and "jane@example.com" are the same email.
- Reason: Prevents duplicate accounts. Industry standard.
- Implemented: src/repositories/user_repo.py:25 (save — lower() comparison)
- Last updated: 2026-05-24

### Password Hashing
- Rule: Passwords are never stored in plain text. Currently using SHA-256 (for test/demo purposes).
- Reason: Security. Production would use bcrypt/passlib.
- Implemented: src/services/password_service.py:14 (hash)
- Last updated: 2026-05-24

### User ID Generation
- Rule: Every user gets a unique UUID v4 at creation time.
- Reason: Non-sequential IDs prevent enumeration attacks.
- Implemented: src/models/user.py:18 (User.__init__)
- Last updated: 2026-05-24
