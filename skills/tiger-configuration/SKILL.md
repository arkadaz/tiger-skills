---
name: tiger-configuration
description: Configuration the way a principal engineer does it, in any language. Everything that differs between environments or that an operator may need to change lives outside the code, is read once at startup into one typed settings value, is checked there so a bad setting stops the program at once, has a safe default where one exists, and keeps secrets out of the code and the repository. Each with its smell and its fix. Use when code needs an address, a credential, a limit, a timeout, a feature switch or any value that changes between machines, and when reviewing such code.
---

# Configuration

The same build must run on a laptop, in a test environment and in production, and differ only by its settings. If moving it to another machine means editing code, it is not configured, it is hard-coded.

## What is a setting

| The value | Is it a setting? |
|---|---|
| differs between environments: an address, a port, the name of a database, a queue or a bucket, a credential | yes |
| an operator may need to change it without a release: a timeout, a pool size, a limit, the log level | yes |
| a switch the spec names, to turn a feature on or off | yes |
| a business rule, such as the largest coupon or the number of days to pay | no. It is a named constant in the domain, unless the spec says the business changes it without a release. |
| nobody will ever change it | no. Do not make an option nobody asked for. |

## One typed settings value

- Every setting is read in one place, when the program starts, into one named type with a typed field for each.
- It is checked right there. A setting that is missing or malformed stops the program at startup, with an error that names the setting. Never at the first request that happens to need it.
- Nothing else reads the environment. What needs a setting is handed that value where the program is wired together.
- Business rules never see the settings value, only the plain values they need.
- Settings do not change after startup.

## Where the values come from

- Environment variables by default, in capitals with one prefix for the program: `ORDERS_DATABASE_URL`.
- A settings file only when the project already has one, loaded into the same typed value.
- Later wins: the built-in default, then the file, then the environment, then a command line option.
- A safe default for whatever has one, such as a timeout or a page size.
- No default for what must differ per environment, such as an address or a credential. Missing is an error.
- A default is always the safe choice. It never points at production and never turns something risky on.
- An example file is checked in, listing every setting with a harmless value. The real one is never committed.
- Every setting is listed in `docs/agent/architecture.md` under Needs: its name and what it is for.

## Secrets

- Never in the code, the repository, a built image, a default, a log line or an error message.
- They arrive at run time, from the environment or the secret store the project uses.
- The settings type marks them, so printing the settings shows `***`.
- A secret committed by mistake is replaced with a new one. Deleting the line is not enough.

## Names and values

- The unit is in the name: `REQUEST_TIMEOUT_SECONDS`, `UPLOAD_LIMIT_BYTES`.
- A switch says what it turns on: `EMAIL_SENDING_ENABLED`. It accepts `true` and `false` and refuses anything else.
- No setting that changes what another setting means.

## Smells

| The smell | The fix |
|---|---|
| an address, a port, a path or a name written in the code | a setting |
| the environment read deep inside a function | read once at startup, and pass the value in |
| the program starts, then fails on the first request because a setting is missing | check every setting at startup |
| `if environment == "production"` in the code | a setting for the behavior itself, such as `EMAIL_SENDING_ENABLED` |
| a default password, or a default that points at production | no default |
| a secret in the repository | the secret store, and a new secret |
| twenty settings nobody has ever changed | delete them. They are constants. |
| the whole settings value passed into every function | pass the two values that function needs |
| a number operators keep asking to change, buried as a constant | a setting with a safe default |

## Prove it

- Start the program with a required setting missing. It must stop at once and name the setting.
- Start it with a malformed one. The same.
- Tests build their settings by hand. They never read the real environment.
- A search of the repository finds no secret.
