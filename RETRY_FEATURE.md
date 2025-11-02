# Shell Command Retry Feature

## Overview

The DaltonCLI now supports automatic retry logic for shell commands with exponential backoff. This feature helps handle transient failures such as network issues, temporary service unavailability, and rate limiting.

## Features

- **Automatic Retries**: Configure retry attempts for shell commands that fail
- **Exponential Backoff**: Delays between retries increase exponentially to avoid overwhelming services
- **Intelligent Retry Logic**: Only retries errors that are likely to be transient (network, rate limit, server errors)
- **Fail-Safe Mode**: Option to continue flow execution even if all retries fail
- **Session Logging**: All retry attempts are logged for debugging and monitoring

## Usage in Flow YAML

### Basic Retry Configuration

Add a `retry` section to any `tool_call` step that uses `shell_exec`:

```yaml
name: "Example Flow with Retry"
description: "Demonstrates retry logic for shell commands"
steps:
  - type: tool_call
    tool_name: shell_exec
    args:
      command: "npm test"
    retry:
      maxAttempts: 3
      delayMs: 1000
```

### All Retry Options

```yaml
steps:
  - type: tool_call
    tool_name: shell_exec
    args:
      command: "npm install"
    retry:
      maxAttempts: 5          # Maximum retry attempts (1-10), default: 3
      delayMs: 2000           # Initial delay in ms (0-60000), default: 1000
      continueOnFailure: true # Continue flow even if all retries fail, default: false
```

### Retry with Fail-Safe Mode

Use `continueOnFailure: true` to continue the flow even if the command fails after all retries:

```yaml
steps:
  - type: tool_call
    tool_name: shell_exec
    args:
      command: "npm test"
    retry:
      maxAttempts: 3
      delayMs: 1000
      continueOnFailure: true  # Flow continues even if tests fail

  - type: tool_call
    tool_name: shell_exec
    args:
      command: "npm run build"  # This still runs even if tests failed
```

## How Retry Logic Works

### 1. Retry Conditions

The retry logic automatically determines if a command should be retried based on:

- **Exit Code**: Non-zero exit codes are retried (except exit code 127 which indicates "command not found")
- **Error Type**: Network errors, rate limits, and server errors are retried
- **No Retry**: Authentication errors and client errors are not retried (they're unlikely to succeed on retry)

### 2. Exponential Backoff

Delays between retries follow an exponential backoff pattern:

- **Attempt 1**: Wait `delayMs` milliseconds
- **Attempt 2**: Wait `delayMs * 2` milliseconds
- **Attempt 3**: Wait `delayMs * 4` milliseconds
- **Maximum**: Delays are capped at 30 seconds

**Example**: With `delayMs: 1000`:
- First retry: 1 second delay
- Second retry: 2 seconds delay
- Third retry: 4 seconds delay
- Fourth retry: 8 seconds delay
- Fifth retry: 16 seconds delay

### 3. Session Logging

All retry attempts are logged to the session log with the following events:

- `command_retry_start`: Logged when retry logic begins
- `command_retry_attempt`: Logged for each retry attempt
- `command_retry_waiting`: Logged when waiting before next retry
- `command_retry_success`: Logged when command succeeds
- `command_retry_exhausted`: Logged when all retries are exhausted

## Examples

### Example 1: Retrying Flaky Tests

```yaml
name: "Run Tests with Retry"
steps:
  - type: tool_call
    tool_name: shell_exec
    args:
      command: "npm test"
    retry:
      maxAttempts: 3
      delayMs: 1000
```

**Output**:
```
[Shell Executor] Executing command (attempt 1/3): npm test
[Shell Executor] Command failed on attempt 1/3, retrying in 1000ms...
[Shell Executor] Failure reason: Exit code 1
[Shell Executor] Executing command (attempt 2/3): npm test
[Shell Executor] Command succeeded on attempt 2/3
```

### Example 2: Installing Dependencies with Network Retries

```yaml
name: "Install Dependencies"
steps:
  - type: tool_call
    tool_name: shell_exec
    args:
      command: "npm install"
    retry:
      maxAttempts: 5
      delayMs: 2000
      continueOnFailure: false  # Stop flow if install fails
```

### Example 3: Multi-Step Flow with Fail-Safe

```yaml
name: "Build and Deploy Pipeline"
steps:
  - type: tool_call
    tool_name: shell_exec
    args:
      command: "npm run lint"
    retry:
      maxAttempts: 2
      delayMs: 500
      continueOnFailure: true  # Continue even if linting fails

  - type: tool_call
    tool_name: shell_exec
    args:
      command: "npm test"
    retry:
      maxAttempts: 3
      delayMs: 1000
      continueOnFailure: true  # Continue even if tests fail

  - type: tool_call
    tool_name: shell_exec
    args:
      command: "npm run build"
    retry:
      maxAttempts: 5
      delayMs: 2000
      continueOnFailure: false  # Stop if build fails
```

## Programmatic Usage

### Using executeCommandWithRetry Directly

```typescript
import { executeCommandWithRetry } from './core/shell_executor';

// Basic usage with defaults
const result = await executeCommandWithRetry('npm test');

// With custom retry options
const result = await executeCommandWithRetry(
  'npm install',
  60000,  // 60 second timeout
  false,  // safe mode disabled
  {
    maxAttempts: 5,
    delayMs: 2000,
    continueOnFailure: false
  }
);

// Check the result
if (result.exitCode === 0) {
  console.log('Command succeeded');
  console.log('Output:', result.stdout);
} else {
  console.error('Command failed');
  console.error('Error:', result.stderr);
}
```

### Custom Retry Logic

```typescript
import { executeCommandWithRetry, CommandResult } from './core/shell_executor';

const result = await executeCommandWithRetry(
  'custom-command',
  60000,
  false,
  {
    maxAttempts: 3,
    delayMs: 1000,
    // Custom retry condition
    shouldRetry: (result: CommandResult) => {
      // Only retry if exit code is 2 or 3
      return result.exitCode === 2 || result.exitCode === 3;
    }
  }
);
```

## Configuration Limits

To prevent abuse and ensure reasonable behavior, the following limits are enforced:

| Parameter | Minimum | Maximum | Default |
|-----------|---------|---------|---------|
| `maxAttempts` | 1 | 10 | 3 |
| `delayMs` | 0 | 60000 (60 sec) | 1000 (1 sec) |
| Backoff delay cap | - | 30000 (30 sec) | - |

## Best Practices

1. **Use Appropriate Retry Counts**:
   - Network operations: 3-5 retries
   - Quick operations: 2-3 retries
   - Critical operations: 5-10 retries

2. **Set Reasonable Delays**:
   - Fast operations: 500-1000ms
   - Network operations: 1000-2000ms
   - API calls with rate limits: 2000-5000ms

3. **Use continueOnFailure Wisely**:
   - Enable for non-critical steps (linting, optional tests)
   - Disable for critical steps (building, deploying)

4. **Monitor Session Logs**:
   - Check logs to identify patterns in failures
   - Adjust retry configuration based on actual failure rates

5. **Combine with Timeouts**:
   - Set appropriate timeouts for each command
   - Timeout should be shorter than total retry time

## Error Handling

### Retryable Errors

The following errors will trigger a retry:
- Network errors (connection refused, DNS failures, timeouts)
- Rate limiting errors (HTTP 429)
- Server errors (HTTP 500, 502, 503, 504)
- Unknown errors (better safe than sorry)

### Non-Retryable Errors

The following errors will NOT trigger a retry:
- Authentication errors (HTTP 401, 403) - credentials won't change
- Client errors (HTTP 400, invalid input) - input won't change
- Command not found (exit code 127) - command won't appear

### continueOnFailure Behavior

When `continueOnFailure: true`:
- Command is retried according to `maxAttempts`
- If all retries fail, the error is logged but NOT thrown
- The flow continues to the next step
- Failed result is stored in `output_to` variable if specified

When `continueOnFailure: false` (default):
- Command is retried according to `maxAttempts`
- If all retries fail, an error is thrown
- The flow stops and reports the failure

## Troubleshooting

### Commands Always Failing

**Problem**: Commands fail even after all retries

**Solutions**:
1. Check if the error is retryable (see Error Handling section)
2. Increase `maxAttempts` or `delayMs`
3. Use `continueOnFailure: true` if the step is optional
4. Check session logs for specific error messages

### Retries Taking Too Long

**Problem**: Flow execution is too slow due to retries

**Solutions**:
1. Reduce `maxAttempts`
2. Reduce `delayMs`
3. Use custom `shouldRetry` function to be more selective
4. Reduce command timeout

### No Retries Happening

**Problem**: Commands fail immediately without retrying

**Solutions**:
1. Ensure `retry` section is present in flow YAML
2. Check if error category is retryable
3. Verify that the tool is `shell_exec` (other tools may not support retry)
4. Check session logs for retry configuration errors

## Technical Implementation

### Architecture

```
Flow YAML → flow_schemas.ts → flow_runner.ts → tool_registry.ts → shell_executor.ts
                                                                           ↓
                                                                  executeCommandWithRetry
                                                                           ↓
                                                                  retry_logic.ts (exponential backoff)
                                                                           ↓
                                                                  session_logger.ts (logging)
```

### Files Modified

1. **C:\Users\deadm\Desktop\.daltoncli\src\core\shell_executor.ts**
   - Added `CommandRetryOptions` interface
   - Added `executeCommandWithRetry` function
   - Added `defaultCommandShouldRetry` function
   - Integrated with `retry_logic.ts` and `session_logger.ts`

2. **C:\Users\deadm\Desktop\.daltoncli\src\core\flow_schemas.ts**
   - Added `RetryConfigSchema` for validating retry configuration
   - Added `retry` field to all step schemas (ChatStep, ToolCallStep, ReadFileStep, ApprovalStep)
   - Exported `RetryConfig` type

3. **C:\Users\deadm\Desktop\.daltoncli\src\core\flow_runner.ts**
   - Updated `executeToolCallStep` to pass retry options to shell_exec tool
   - Added support for `continueOnFailure` in error handling
   - Enhanced logging to include retry configuration

4. **C:\Users\deadm\Desktop\.daltoncli\src\core\tool_registry.ts**
   - Updated `shell_exec` tool definition to accept retry options
   - Modified tool function to use `executeCommandWithRetry` when retry options are provided
   - Falls back to `executeCommand` for backward compatibility

### Integration with Existing Features

The retry feature integrates seamlessly with:
- **Session Logging**: All retry attempts are logged
- **Policy Engine**: Retry logic respects policy validation
- **Safe Mode**: Works with whitelisted commands
- **Bash Translation**: Translates commands before retrying (Windows only)
- **Network Allowlist**: Respects `--allow-network` flag
- **Dry Run Mode**: Shows retry configuration without executing

## Future Enhancements

Potential improvements for future versions:
1. Configurable jitter factor for backoff delays
2. Circuit breaker pattern for repeated failures
3. Retry budget to limit total retry time across flow
4. Conditional retry based on command output (not just exit code)
5. Retry statistics in flow execution summary
6. Webhook notifications on retry exhaustion

## Support

For issues or questions about the retry feature:
1. Check session logs for detailed retry information
2. Review this documentation for configuration examples
3. Verify retry configuration against limits and best practices
4. Check that command errors are in the retryable category
