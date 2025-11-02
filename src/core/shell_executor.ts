import { spawn } from 'child_process';
import * as os from 'os';
import { getShellLimits } from './app_limits';
import { withRetry, RetryOptions, categorizeError, ErrorCategory } from './retry_logic';
import { logSession } from './session_logger';

/**
 * Result of a command execution
 */
export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error: Error | null;
}

/**
 * Options for command retry behavior
 */
export interface CommandRetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;

  /** Initial delay before first retry in ms (default: 1000) */
  delayMs?: number;

  /** Continue flow execution even if all retries fail (default: false) */
  continueOnFailure?: boolean;

  /** Custom function to determine if command should be retried based on result */
  shouldRetry?: (result: CommandResult) => boolean;
}

/**
 * Determines the appropriate shell to use based on the operating system
 * @returns The shell executable path
 */
const getShellExecutable = (): string => {
  const platform = os.platform();

  if (platform === 'win32') {
    // On Windows, use PowerShell
    return 'powershell.exe';
  }

  // On Unix-like systems (Linux, macOS), use bash or fallback to sh
  return process.env.SHELL || '/bin/bash';
};

/**
 * Whitelist of safe commands for safe mode execution
 */
const SAFE_COMMAND_WHITELIST = [
  'ls', 'dir', 'cat', 'more', 'less', 'grep', 'find', 'echo', 'pwd',
  'git --version', 'node --version', 'npm --version', 'python --version',
];

/**
 * Sanitizes input by escaping dangerous shell metacharacters
 * @param input - The input string to sanitize
 * @returns The sanitized input string
 */
const sanitizeInput = (input: string): string => {
  return input.replace(/[&;`|*?~<>^()\[\]{},\$\\'"]/g, '\\$&');
};

/**
 * Validates a command against common command injection patterns
 * Platform-aware: PowerShell allows pipes and semicolons safely
 * @param command - The command to validate
 * @returns true if the command is safe, false otherwise
 */
const isCommandSafeFromInjection = (command: string): boolean => {
  const platform = os.platform();

  if (platform === 'win32') {
    // PowerShell-specific dangerous patterns
    // Pipes (|) and semicolons (;) are safe in PowerShell
    const dangerousPatterns = [
      /&&/,           // Command chaining (but single & is OK for background jobs)
      /\$\(/,         // Command substitution (though PowerShell uses this safely)
      /<</,           // Here-doc (bash)
      />\s*&/,        // Redirect stderr to stdout in unsafe way
    ];
    return !dangerousPatterns.some(pattern => pattern.test(command));
  } else {
    // Unix/Linux bash dangerous patterns
    const dangerousPatterns = [
      /[;&|`]/,       // Command separators and backticks
      /\$\(/,         // Command substitution
      /\$\{/,         // Variable expansion
      /<</,           // Here-doc
    ];
    return !dangerousPatterns.some(pattern => pattern.test(command));
  }
};

/**
 * Translates common bash commands to PowerShell equivalents
 * @param command - The bash command to translate
 * @returns The translated PowerShell command
 */
const translateBashToPowerShell = (command: string): string => {
  // Only translate on Windows
  if (process.platform !== 'win32') {
    return command;
  }

  let translated = command;
  let wasTranslated = false;

  // DEFENSIVE FIX: Strip any existing powershell/pwsh wrapper to prevent double-wrapping
  // Matches: powershell -Command "..." or pwsh.exe -Command '...' or pwsh -c "..."
  const wrapperPattern = /^(powershell|pwsh)(\.exe)?\s+(-Command|-c)\s+["'](.*)["']$/is;
  const wrapperMatch = translated.match(wrapperPattern);

  if (wrapperMatch) {
    // Extract the inner command (group 4)
    translated = wrapperMatch[4];
    console.warn(`[Shell Executor] Detected double-wrapping - stripped outer PowerShell wrapper`);
    console.warn(`[Shell Executor] Original: "${command.substring(0, 100)}${command.length > 100 ? '...' : ''}"`);
    console.warn(`[Shell Executor] Unwrapped: "${translated.substring(0, 100)}${translated.length > 100 ? '...' : ''}"`);
  }

  // Translation patterns (order matters - more specific patterns first)
  const translations = [
    // Complex bash conditionals: if [ -f file ]; then...; else...; fi
    {
      pattern: /if\s+\[\s+-f\s+(['"]?)([^\s'"]+)\1\s*\];\s*then\s+echo\s+(['"])([^'"]+)\3;\s*else\s+echo\s+(['"])([^'"]+)\5;\s*fi/gi,
      replacement: 'if (Test-Path $2) { "$4" } else { "$6" }',
      description: 'if [ -f file ]; then echo X; else echo Y; fi → if (Test-Path) { X } else { Y }',
    },
    // Complex bash conditionals: if [ -d dir ]; then...; else...; fi
    {
      pattern: /if\s+\[\s+-d\s+(['"]?)([^\s'"]+)\1\s*\];\s*then\s+echo\s+(['"])([^'"]+)\3;\s*else\s+echo\s+(['"])([^'"]+)\5;\s*fi/gi,
      replacement: 'if (Test-Path $2) { "$4" } else { "$6" }',
      description: 'if [ -d dir ]; then echo X; else echo Y; fi → if (Test-Path) { X } else { Y }',
    },
    // test -f <file> → Test-Path <file>
    {
      pattern: /\btest\s+-f\s+(['"]?)([^\s'"]+)\1/g,
      replacement: 'Test-Path $2',
      description: 'test -f → Test-Path',
    },
    // test -d <dir> → Test-Path <dir>
    {
      pattern: /\btest\s+-d\s+(['"]?)([^\s'"]+)\1/g,
      replacement: 'Test-Path $2',
      description: 'test -d → Test-Path',
    },
    // ls -la → Get-ChildItem -Force
    {
      pattern: /\bls\s+-la\b/g,
      replacement: 'Get-ChildItem -Force',
      description: 'ls -la → Get-ChildItem -Force',
    },
    // ls -l → Get-ChildItem
    {
      pattern: /\bls\s+-l\b/g,
      replacement: 'Get-ChildItem',
      description: 'ls -l → Get-ChildItem',
    },
    // cat <file> → Get-Content <file>
    {
      pattern: /\bcat\s+(['"]?)([^\s'"]+)\1/g,
      replacement: 'Get-Content $2',
      description: 'cat → Get-Content',
    },
    // head -n N <file> → Get-Content <file> | Select-Object -First N
    {
      pattern: /\bhead\s+-n\s+(\d+)\s+(['"]?)([^\s'"]+)\2/g,
      replacement: 'Get-Content $3 | Select-Object -First $1',
      description: 'head -n → Select-Object -First',
    },
    // tail -n N <file> → Get-Content <file> | Select-Object -Last N
    {
      pattern: /\btail\s+-n\s+(\d+)\s+(['"]?)([^\s'"]+)\2/g,
      replacement: 'Get-Content $3 | Select-Object -Last $1',
      description: 'tail -n → Select-Object -Last',
    },
    // pwd → Get-Location (PowerShell has built-in alias, but be explicit)
    {
      pattern: /\bpwd\b/g,
      replacement: 'Get-Location',
      description: 'pwd → Get-Location',
    },
    // && → ; (sequential execution)
    {
      pattern: /\s+&&\s+/g,
      replacement: '; ',
      description: '&& → ;',
    },
  ];

  // Apply translations
  for (const { pattern, replacement, description } of translations) {
    const before = translated;
    translated = translated.replace(pattern, replacement);
    if (translated !== before) {
      wasTranslated = true;
      console.warn(`[Shell Translator] ${description}: "${before.trim()}" → "${translated.trim()}"`);
    }
  }

  // Check for untranslatable bash patterns
  const untranslatablePatterns = [
    { pattern: /\|\|/, message: 'Bash || operator (or logic) - consider using PowerShell error handling' },
    { pattern: /\$\(/, message: 'Bash command substitution $() - use PowerShell $() or ` for line continuation' },
    { pattern: /`(?!`)/, message: 'Bash backticks - use PowerShell $() for command substitution' },
    { pattern: /\[\[.*\]\]/, message: 'Bash [[ ]] test syntax - use PowerShell conditional operators' },
  ];

  for (const { pattern, message } of untranslatablePatterns) {
    if (pattern.test(translated)) {
      console.warn(`[Shell Translator] Warning: Detected potentially untranslatable syntax: ${message}`);
    }
  }

  return translated;
};

/**
 * Executes a shell command with optional safety checks
 * @param command - The command to execute
 * @param timeout - Timeout in milliseconds (default: 60000)
 * @param safeMode - Whether to enforce whitelist validation (default: false)
 * @returns Promise resolving to the CommandResult
 */
export async function executeCommand(
  command: string,
  timeout: number = 60000,
  safeMode: boolean = false,
): Promise<CommandResult> {
  // Translate bash commands to PowerShell on Windows
  const translatedCommand = translateBashToPowerShell(command);

  if (!isCommandSafeFromInjection(translatedCommand)) {
    return {
      stdout: '',
      stderr: 'Command rejected: Contains potentially dangerous shell metacharacters. Please use safe command alternatives.',
      exitCode: 1,
      error: new Error('Command contains dangerous shell patterns'),
    };
  }

  if (safeMode) {
    const isWhitelisted = SAFE_COMMAND_WHITELIST.includes(translatedCommand);
    if (!isWhitelisted) {
      return {
        stdout: '',
        stderr: `Command '${translatedCommand}' is not whitelisted for safe mode execution.`,
        exitCode: 1,
        error: new Error('Command not whitelisted in safe mode'),
      };
    }
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let commandError: Error | null = null;

    // Get the appropriate shell for the current platform
    const shellExecutable = getShellExecutable();
    const platform = os.platform();

    // Configure spawn options based on platform
    let spawnOptions: any;
    let spawnCommand: string;
    let spawnArgs: string[];

    if (platform === 'win32') {
      // On Windows, use PowerShell with proper command execution
      spawnCommand = shellExecutable;
      spawnArgs = ['-NoProfile', '-NonInteractive', '-Command', translatedCommand];
      spawnOptions = { timeout };
    } else {
      // On Unix-like systems, use the shell with -c flag
      spawnCommand = shellExecutable;
      spawnArgs = ['-c', translatedCommand];
      spawnOptions = { timeout };
    }

    const child = spawn(spawnCommand, spawnArgs, spawnOptions);

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      commandError = error;
      resolve({
        stdout,
        stderr,
        exitCode: null,
        error: commandError,
      });
    });

    child.on('close', (exitCode) => {
      resolve({
        stdout,
        stderr,
        exitCode,
        error: commandError,
      });
    });

    child.on('timeout', () => {
      commandError = new Error(`Command timed out after ${timeout / 1000} seconds.`);
      child.kill(); // Kill the process if it times out
    });
  });
}

/**
 * Default retry condition for shell commands
 * Retries on non-zero exit codes and errors, but not for client errors
 * @param result - The command result to evaluate
 * @returns true if the command should be retried
 */
export function defaultCommandShouldRetry(result: CommandResult): boolean {
  // Don't retry if command succeeded
  if (result.exitCode === 0 && !result.error) {
    return false;
  }

  // If there's an error, categorize it
  if (result.error) {
    const category = categorizeError(result.error);
    // Retry network, rate limit, and server errors
    return (
      category === ErrorCategory.NETWORK ||
      category === ErrorCategory.RATE_LIMIT ||
      category === ErrorCategory.SERVER_ERROR ||
      category === ErrorCategory.UNKNOWN
    );
  }

  // Retry on non-zero exit codes (could be transient failures)
  // But not for common "not found" exit codes (127 on Unix, various on Windows)
  if (result.exitCode !== null) {
    // Exit code 127 typically means "command not found" - don't retry
    if (result.exitCode === 127) {
      return false;
    }
    // Other non-zero exit codes might be transient - retry them
    return true;
  }

  return false;
}

/**
 * Executes a shell command with automatic retry logic using exponential backoff
 *
 * This function wraps executeCommand with retry capabilities, making it suitable for
 * handling transient failures in shell commands (e.g., network issues, temporary
 * service unavailability, rate limiting).
 *
 * @param command - The shell command to execute
 * @param timeout - Timeout in milliseconds for each command attempt (default: 60000)
 * @param safeMode - Whether to enforce whitelist validation (default: false)
 * @param retryOptions - Options for retry behavior
 * @returns Promise resolving to the CommandResult
 *
 * @example
 * ```typescript
 * // Retry npm install up to 5 times with 2 second delay
 * const result = await executeCommandWithRetry(
 *   'npm install',
 *   60000,
 *   false,
 *   { maxAttempts: 5, delayMs: 2000 }
 * );
 * ```
 *
 * @example
 * ```typescript
 * // Continue even if command fails after all retries
 * const result = await executeCommandWithRetry(
 *   'npm test',
 *   30000,
 *   false,
 *   { maxAttempts: 3, continueOnFailure: true }
 * );
 * ```
 */
export async function executeCommandWithRetry(
  command: string,
  timeout: number = 60000,
  safeMode: boolean = false,
  retryOptions: CommandRetryOptions = {}
): Promise<CommandResult> {
  // DEFENSIVE: Validate inputs
  if (typeof command !== 'string' || command.trim().length === 0) {
    const error = new Error('Command must be a non-empty string');
    return {
      stdout: '',
      stderr: error.message,
      exitCode: 1,
      error,
    };
  }

  // Extract retry options with defaults from app_limits
  const shellLimits = getShellLimits();
  const maxAttempts = retryOptions.maxAttempts ?? shellLimits.maxRetries;
  const delayMs = retryOptions.delayMs ?? shellLimits.retryDelay;
  const continueOnFailure = retryOptions.continueOnFailure ?? false;
  const shouldRetryFn = retryOptions.shouldRetry ?? defaultCommandShouldRetry;

  // DEFENSIVE: Validate retry options
  if (maxAttempts < 1 || maxAttempts > 10) {
    const error = new Error('maxAttempts must be between 1 and 10');
    logSession('command_retry_error', { command, error: error.message });
    return {
      stdout: '',
      stderr: error.message,
      exitCode: 1,
      error,
    };
  }

  if (delayMs < 0 || delayMs > 60000) {
    const error = new Error('delayMs must be between 0 and 60000');
    logSession('command_retry_error', { command, error: error.message });
    return {
      stdout: '',
      stderr: error.message,
      exitCode: 1,
      error,
    };
  }

  let lastResult: CommandResult = {
    stdout: '',
    stderr: '',
    exitCode: null,
    error: new Error('No attempts made'),
  };

  let attempt = 0;

  // Log the retry attempt
  logSession('command_retry_start', {
    command: command.substring(0, 100),
    maxAttempts,
    delayMs,
    continueOnFailure,
  });

  while (attempt < maxAttempts) {
    attempt++;

    try {
      // Log the current attempt
      logSession('command_retry_attempt', {
        command: command.substring(0, 100),
        attempt,
        maxAttempts,
      });

      console.log(`[Shell Executor] Executing command (attempt ${attempt}/${maxAttempts}): ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`);

      // Execute the command
      lastResult = await executeCommand(command, timeout, safeMode);

      // Check if command succeeded
      if (lastResult.exitCode === 0 && !lastResult.error) {
        // Success - log and return
        logSession('command_retry_success', {
          command: command.substring(0, 100),
          attempt,
          exitCode: lastResult.exitCode,
        });

        console.log(`[Shell Executor] Command succeeded on attempt ${attempt}/${maxAttempts}`);
        return lastResult;
      }

      // Command failed - check if we should retry
      const willRetry = attempt < maxAttempts && shouldRetryFn(lastResult);

      if (!willRetry) {
        // No more retries or shouldn't retry this error
        logSession('command_retry_exhausted', {
          command: command.substring(0, 100),
          attempt,
          exitCode: lastResult.exitCode,
          error: lastResult.error?.message,
          continueOnFailure,
        });

        console.log(`[Shell Executor] Command failed on attempt ${attempt}/${maxAttempts}, will not retry`);

        // If continueOnFailure is true, return the failed result instead of throwing
        if (continueOnFailure) {
          console.log(`[Shell Executor] Continuing flow execution despite failure (continueOnFailure=true)`);
          return lastResult;
        }

        // Otherwise, throw the error if present
        if (lastResult.error) {
          throw lastResult.error;
        }

        return lastResult;
      }

      // Calculate delay for this retry (exponential backoff)
      const retryDelay = delayMs * Math.pow(2, attempt - 1);
      const cappedDelay = Math.min(retryDelay, 30000); // Cap at 30 seconds

      console.log(`[Shell Executor] Command failed on attempt ${attempt}/${maxAttempts}, retrying in ${cappedDelay}ms...`);
      console.log(`[Shell Executor] Failure reason: ${lastResult.error?.message || `Exit code ${lastResult.exitCode}`}`);

      logSession('command_retry_waiting', {
        command: command.substring(0, 100),
        attempt,
        delayMs: cappedDelay,
        reason: lastResult.error?.message || `Exit code ${lastResult.exitCode}`,
      });

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, cappedDelay));
    } catch (error) {
      // Catch any unexpected errors during execution
      const errorObj = error instanceof Error ? error : new Error(String(error));
      lastResult = {
        stdout: lastResult.stdout || '',
        stderr: lastResult.stderr || errorObj.message,
        exitCode: lastResult.exitCode,
        error: errorObj,
      };

      // If this was the last attempt or we shouldn't retry, handle accordingly
      if (attempt >= maxAttempts) {
        logSession('command_retry_exhausted', {
          command: command.substring(0, 100),
          attempt,
          error: errorObj.message,
          continueOnFailure,
        });

        if (continueOnFailure) {
          console.log(`[Shell Executor] All retries exhausted, continuing flow execution (continueOnFailure=true)`);
          return lastResult;
        }

        throw errorObj;
      }

      // Calculate delay and continue to next retry
      const retryDelay = delayMs * Math.pow(2, attempt - 1);
      const cappedDelay = Math.min(retryDelay, 30000);

      console.log(`[Shell Executor] Error on attempt ${attempt}/${maxAttempts}: ${errorObj.message}`);
      console.log(`[Shell Executor] Retrying in ${cappedDelay}ms...`);

      await new Promise((resolve) => setTimeout(resolve, cappedDelay));
    }
  }

  // Should not reach here, but return last result as fallback
  logSession('command_retry_exhausted', {
    command: command.substring(0, 100),
    attempts: attempt,
    continueOnFailure,
  });

  if (continueOnFailure) {
    return lastResult;
  }

  if (lastResult.error) {
    throw lastResult.error;
  }

  return lastResult;
}
