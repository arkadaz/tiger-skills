---
name: tiger-logging
description: Logging the way a principal engineer does it, in any language. Logs are written for the person who has to find out what went wrong - one structured event per thing that happened, at the edge, at the right level, with the ids that tie a request together, an error logged once where it is handled, and never a secret or personal data. Each with its smell and its fix. Use when writing or reviewing code that handles requests, jobs, errors or calls to other systems, and whenever a log line is added.
---

# Logging

A log is written for someone at three in the morning who has never seen this code and must find out what happened. Every line should help that person. A line that does not is noise that hides the one they need.

## What to log

| Log this | With |
|---|---|
| the program starting and stopping | version, and the settings that matter, never their secret values |
| each request or job, once, when it ends | what it was, the outcome, how long it took |
| each call to another system that fails or is slow | which system, the outcome, how long it took |
| each business event worth knowing about | what happened and to which thing, by id |
| each error, once | the kind of error, its message, the trace, and the ids that explain it |

Do not log every step of the code, a value the next line logs again, or "entering" and "leaving" a function.

## How to write a line

- A fixed event name and named fields, not a sentence glued together from values. The name never changes; the fields carry what varies.
- The same field name for the same thing everywhere: `order_id` is never `orderId` in one place and `id` in another.
- Put the unit in the name: `duration_ms`, `size_bytes`.
- Every line of one request carries the same request id, and that id is passed on to every system it calls.
- Use ids, not contents. Log `order_id`, not the order.

```
event=order_paid order_id=8f21 customer_id=c77 amount_cents=1999 duration_ms=42 request_id=a1b2
```

## Levels

| Level | Means | Example |
|---|---|---|
| error | something is broken and a person must act | the database refused the write |
| warning | it worked, but not the normal way, and it matters if it repeats | a retry was needed, a fallback was used |
| info | normal events worth a record | request finished, order paid, job done |
| debug | detail for the developer, switched off in production | the query that was built |

A user sending bad input is not an error. It is normal, and logged as info at most.

## Where

- At the edge: where requests come in, where calls go out, and where an error is finally handled. Business rules do not log. They return a value or an error, and the edge logs it.
- An error is logged once, at the place that handles it. Never log an error and pass it on: it will be logged again above, and one failure turns into five lines.
- The logger is set up once, where the program starts. Use the logging library the project already has, or the standard one. Never a home-made logger, and never plain printing.
- Write to standard output and let the platform collect it. No log files of your own.

## Never

- A password, a token, a key, a session id or a card number.
- Personal data: names, emails, addresses, phone numbers, unless the spec says this field may be logged.
- A whole request, response or record. Log its id and the two or three fields that matter.
- A line inside a loop that runs thousands of times. Log the total once after it.
- Work to build a message that will not be written. Pass the values and let the logger decide.

## Smells

| The smell | The fix |
|---|---|
| a sentence built by joining text and values | an event name with fields |
| the same error in the log five times | log it once, where it is handled |
| every request logged at error because the user typed something wrong | info, with the reason |
| a line nobody could act on | delete it |
| a log line in a business rule | return the fact, and log it at the edge |
| lines of one request that cannot be tied together | a request id on every line |
| "something went wrong" | which thing, to what, with which ids |
| plain printing left in the code | the logger, or delete it |

## Prove it

- Make one request fail on purpose and read the log. It must tell you what failed, for which thing, and why, in one error line.
- Search the log of a normal run for a secret and for personal data. Neither may appear.
- A log line is not asserted in tests, except this: a path that must never log a secret has a test proving it does not.
