# Shell Command Retry - Quick Start Guide

## 30-Second Overview

Add retry logic to shell commands in your flow YAML with automatic exponential backoff and intelligent error handling.

## Basic Usage

```yaml
steps:
  - type: tool_call
    tool_name: shell_exec
    args:
      command: "npm test"
    retry:
      maxAttempts: 3
      delayMs: 1000
```

That's it! The command will retry up to 3 times with exponential backoff (1s, 2s, 4s).

## Common Patterns

### Pattern 1: Flaky Network Commands
```yaml
- type: tool_call
  tool_name: shell_exec
  args:
    command: "npm install"
  retry:
    maxAttempts: 5
    delayMs: 2000
```

### Pattern 2: Optional Commands (Continue on Failure)
```yaml
- type: tool_call
  tool_name: shell_exec
  args:
    command: "npm run lint"
  retry:
    maxAttempts: 2
    delayMs: 500
    continueOnFailure: true  # Keep going even if linting fails
```

### Pattern 3: Critical Commands (No Retry)
```yaml
- type: tool_call
  tool_name: shell_exec
  args:
    command: "npm run deploy"
  # No retry section = runs once, fails immediately if error
```

## Configuration Options

| Option | Type | Range | Default | Description |
|--------|------|-------|---------|-------------|
| `maxAttempts` | number | 1-10 | 3 | Number of retry attempts |
| `delayMs` | number | 0-60000 | 1000 | Initial delay in milliseconds |
| `continueOnFailure` | boolean | - | false | Continue flow even if all retries fail |

## What Gets Retried?

**YES - Will Retry:**
- Network errors (timeouts, connection refused)
- Rate limiting (HTTP 429)
- Server errors (HTTP 500, 502, 503, 504)
- Non-zero exit codes (except 127)

**NO - Won't Retry:**
- Authentication errors (HTTP 401, 403)
- Client errors (HTTP 400)
- Command not found (exit code 127)

## Exponential Backoff

Delays double after each retry (capped at 30 seconds):

```
Attempt 1: delayMs × 1
Attempt 2: delayMs × 2
Attempt 3: delayMs × 4
Attempt 4: delayMs × 8
```

Example with `delayMs: 1000`:
- Retry 1: Wait 1 second
- Retry 2: Wait 2 seconds
- Retry 3: Wait 4 seconds
- Retry 4: Wait 8 seconds

## Complete Example

```yaml
name: "CI/CD Pipeline with Retry"
steps:
  # Tests (optional, continue if fail)
  - type: tool_call
    tool_name: shell_exec
    args:
      command: "npm test"
    retry:
      maxAttempts: 3
      delayMs: 1000
      continueOnFailure: true

  # Build (critical, retry but stop if fail)
  - type: tool_call
    tool_name: shell_exec
    args:
      command: "npm run build"
    retry:
      maxAttempts: 5
      delayMs: 2000
      continueOnFailure: false

  # Deploy (no retry, runs once)
  - type: tool_call
    tool_name: shell_exec
    args:
      command: "npm run deploy"
```

## Console Output

```
[Shell Executor] Executing command (attempt 1/3): npm test
[Shell Executor] Command failed on attempt 1/3, retrying in 1000ms...
[Shell Executor] Failure reason: Exit code 1
[Shell Executor] Executing command (attempt 2/3): npm test
[Shell Executor] Command succeeded on attempt 2/3
```

## Session Logs

All retries are logged for monitoring:
- `command_retry_start` - Retry logic started
- `command_retry_attempt` - Each attempt
- `command_retry_waiting` - Waiting before retry
- `command_retry_success` - Command succeeded
- `command_retry_exhausted` - All retries failed

## When to Use Retry

**Good Use Cases:**
- npm install (network issues)
- npm test (flaky tests)
- git clone/pull (network issues)
- API health checks (temporary unavailability)
- Database migrations (temporary locks)

**Bad Use Cases:**
- Commands that always fail the same way
- Commands with destructive side effects
- Commands that take very long (increase timeout instead)
- Commands that need user input

## Need More?

- **Full Documentation**: See `RETRY_FEATURE.md`
- **Implementation Details**: See `RETRY_IMPLEMENTATION_SUMMARY.md`
- **Working Example**: See `examples/flow-with-retry.yaml`

## Troubleshooting

**Command not retrying?**
- Check if error is retryable (auth/client errors won't retry)
- Verify retry section is under the step, not under args
- Check session logs for retry events

**Retries taking too long?**
- Reduce `maxAttempts`
- Reduce `delayMs`
- Consider if command really needs retry

**Want to see what's happening?**
- Run in dry-run mode: shows retry config without executing
- Check session logs: detailed retry events
- Console shows attempt numbers and delays
