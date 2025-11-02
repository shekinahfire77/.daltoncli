/**
 * Application-wide configurable limits
 *
 * This module centralizes all hardcoded limits and thresholds used throughout the application,
 * making them configurable and consistent. All limits can be overridden via environment variables
 * or configuration files.
 *
 * @module core/app_limits
 */

/**
 * Chat and session configuration limits
 */
export interface ChatLimits {
  /** Maximum number of messages to keep in chat history */
  historyLimit: number;

  /** Maximum number of messages before session rotation */
  maxSessionSize: number;

  /** Maximum history limit that can be set by user */
  maxHistoryUpperBound: number;

  /** Minimum history limit that can be set by user */
  maxHistoryLowerBound: number;

  /** Threshold for warning when loading sessions with many messages */
  sessionLoadWarningThreshold: number;

  /** Threshold for rotating chat history to prevent unbounded growth */
  chatHistoryRotationThreshold: number;
}

/**
 * File operation limits
 */
export interface FileLimits {
  /** Maximum bytes to read from a file */
  maxReadBytes: number;

  /** Maximum file size warning threshold */
  warningThreshold: number;
}

/**
 * Shell execution limits
 */
export interface ShellLimits {
  /** Default timeout for shell command execution (ms) */
  execTimeout: number;

  /** Maximum allowed command length */
  maxCommandLength: number;

  /** Maximum number of retry attempts for failed commands */
  maxRetries: number;

  /** Initial delay before first retry (ms) */
  retryDelay: number;

  /** Exit codes that should trigger a retry */
  retryExitCodes: number[];
}

/**
 * API timeout configuration
 */
export interface ApiTimeouts {
  /** Default timeout for API calls (ms) */
  default: number;

  /** Minimum allowed timeout (ms) */
  min: number;

  /** Maximum allowed timeout (ms) */
  max: number;
}

/**
 * Retry configuration for API calls
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;

  /** Initial delay before first retry (ms) */
  initialDelay: number;

  /** Maximum delay between retries (ms) */
  maxDelay: number;

  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: number;

  /** Jitter factor to add randomness (0-1) */
  jitterFactor: number;
}

/**
 * Policy engine limits
 */
export interface PolicyLimits {
  /** Code block threshold for policy decisions */
  codeBlockThreshold: number;
}

/**
 * Complete application limits configuration
 */
export interface AppLimitsConfig {
  chat: ChatLimits;
  file: FileLimits;
  shell: ShellLimits;
  api: ApiTimeouts;
  retry: RetryConfig;
  policy: PolicyLimits;
}

/**
 * Default application limits
 * These can be overridden via environment variables or config file
 */
const DEFAULT_LIMITS: AppLimitsConfig = {
  chat: {
    historyLimit: parseInt(process.env.DALTON_CHAT_HISTORY_LIMIT || '10', 10),
    maxSessionSize: parseInt(process.env.DALTON_MAX_SESSION_SIZE || '100', 10),
    maxHistoryUpperBound: parseInt(process.env.DALTON_MAX_HISTORY_UPPER_BOUND || '1000', 10),
    maxHistoryLowerBound: parseInt(process.env.DALTON_MAX_HISTORY_LOWER_BOUND || '1', 10),
    sessionLoadWarningThreshold: parseInt(process.env.DALTON_SESSION_LOAD_WARNING_THRESHOLD || '100', 10),
    chatHistoryRotationThreshold: parseInt(process.env.DALTON_CHAT_HISTORY_ROTATION_THRESHOLD || '100', 10),
  },

  file: {
    maxReadBytes: parseInt(process.env.DALTON_MAX_READ_BYTES || '50000', 10),
    warningThreshold: parseInt(process.env.DALTON_FILE_WARNING_THRESHOLD || '50000', 10),
  },

  shell: {
    execTimeout: parseInt(process.env.DALTON_SHELL_TIMEOUT || '15000', 10),
    maxCommandLength: parseInt(process.env.DALTON_MAX_COMMAND_LENGTH || '10000', 10),
    maxRetries: parseInt(process.env.DALTON_SHELL_MAX_RETRIES || '3', 10),
    retryDelay: parseInt(process.env.DALTON_SHELL_RETRY_DELAY || '1000', 10),
    retryExitCodes: process.env.DALTON_SHELL_RETRY_EXIT_CODES
      ? process.env.DALTON_SHELL_RETRY_EXIT_CODES.split(',').map(code => parseInt(code.trim(), 10))
      : [1, 126, 127],
  },

  api: {
    default: parseInt(process.env.DALTON_API_TIMEOUT_DEFAULT || '30000', 10),
    min: parseInt(process.env.DALTON_API_TIMEOUT_MIN || '1000', 10),
    max: parseInt(process.env.DALTON_API_TIMEOUT_MAX || '600000', 10),
  },

  retry: {
    maxRetries: parseInt(process.env.DALTON_MAX_RETRIES || '3', 10),
    initialDelay: parseInt(process.env.DALTON_RETRY_INITIAL_DELAY || '1000', 10),
    maxDelay: parseInt(process.env.DALTON_RETRY_MAX_DELAY || '10000', 10),
    backoffMultiplier: parseFloat(process.env.DALTON_RETRY_BACKOFF_MULTIPLIER || '2'),
    jitterFactor: parseFloat(process.env.DALTON_RETRY_JITTER_FACTOR || '0.1'),
  },

  policy: {
    codeBlockThreshold: parseInt(process.env.DALTON_CODE_BLOCK_THRESHOLD || '10', 10),
  },
};

/**
 * Current application limits (can be updated at runtime)
 */
let currentLimits: AppLimitsConfig = { ...DEFAULT_LIMITS };

/**
 * Gets the current application limits configuration
 * @returns Current limits configuration
 */
export function getAppLimits(): Readonly<AppLimitsConfig> {
  return currentLimits;
}

/**
 * Gets a specific limit category
 * @param category - The category to retrieve
 * @returns The specified limits
 */
export function getChatLimits(): Readonly<ChatLimits> {
  return currentLimits.chat;
}

export function getFileLimits(): Readonly<FileLimits> {
  return currentLimits.file;
}

export function getShellLimits(): Readonly<ShellLimits> {
  return currentLimits.shell;
}

export function getApiTimeouts(): Readonly<ApiTimeouts> {
  return currentLimits.api;
}

export function getRetryConfig(): Readonly<RetryConfig> {
  return currentLimits.retry;
}

export function getPolicyLimits(): Readonly<PolicyLimits> {
  return currentLimits.policy;
}

/**
 * Updates application limits at runtime
 * @param updates - Partial configuration to merge with current limits
 */
export function updateAppLimits(updates: Partial<AppLimitsConfig>): void {
  currentLimits = {
    ...currentLimits,
    ...updates,
    chat: { ...currentLimits.chat, ...(updates.chat || {}) },
    file: { ...currentLimits.file, ...(updates.file || {}) },
    shell: { ...currentLimits.shell, ...(updates.shell || {}) },
    api: { ...currentLimits.api, ...(updates.api || {}) },
    retry: { ...currentLimits.retry, ...(updates.retry || {}) },
    policy: { ...currentLimits.policy, ...(updates.policy || {}) },
  };
}

/**
 * Resets all limits to default values
 */
export function resetAppLimits(): void {
  currentLimits = { ...DEFAULT_LIMITS };
}

/**
 * Validates that all limits are within reasonable bounds
 * @throws {Error} If any limit is invalid
 */
export function validateLimits(limits: AppLimitsConfig): void {
  // Validate chat limits
  if (limits.chat.historyLimit < 1) {
    throw new Error('Chat history limit must be at least 1');
  }

  if (limits.chat.maxSessionSize < limits.chat.historyLimit) {
    throw new Error('Max session size must be greater than or equal to history limit');
  }

  if (limits.chat.maxHistoryLowerBound < 1) {
    throw new Error('Max history lower bound must be at least 1');
  }

  if (limits.chat.maxHistoryUpperBound < limits.chat.maxHistoryLowerBound) {
    throw new Error('Max history upper bound must be greater than lower bound');
  }

  if (limits.chat.sessionLoadWarningThreshold < 1) {
    throw new Error('Session load warning threshold must be at least 1');
  }

  if (limits.chat.chatHistoryRotationThreshold < 1) {
    throw new Error('Chat history rotation threshold must be at least 1');
  }

  // Validate file limits
  if (limits.file.maxReadBytes < 1) {
    throw new Error('Max read bytes must be at least 1');
  }

  // Validate shell limits
  if (limits.shell.execTimeout < 1000) {
    throw new Error('Shell execution timeout must be at least 1000ms');
  }

  if (limits.shell.maxCommandLength < 1) {
    throw new Error('Max command length must be at least 1');
  }

  if (limits.shell.maxRetries < 0) {
    throw new Error('Shell max retries must be non-negative');
  }

  if (limits.shell.retryDelay < 0) {
    throw new Error('Shell retry delay must be non-negative');
  }

  if (!Array.isArray(limits.shell.retryExitCodes)) {
    throw new Error('Shell retry exit codes must be an array');
  }

  // Validate API timeouts
  if (limits.api.min < 100) {
    throw new Error('Minimum API timeout must be at least 100ms');
  }

  if (limits.api.max < limits.api.min) {
    throw new Error('Maximum API timeout must be greater than minimum');
  }

  if (limits.api.default < limits.api.min || limits.api.default > limits.api.max) {
    throw new Error('Default API timeout must be between min and max');
  }

  // Validate retry configuration
  if (limits.retry.maxRetries < 0) {
    throw new Error('Max retries must be non-negative');
  }

  if (limits.retry.initialDelay < 0) {
    throw new Error('Initial retry delay must be non-negative');
  }

  if (limits.retry.maxDelay < limits.retry.initialDelay) {
    throw new Error('Max retry delay must be greater than or equal to initial delay');
  }

  if (limits.retry.backoffMultiplier <= 1) {
    throw new Error('Backoff multiplier must be greater than 1');
  }

  if (limits.retry.jitterFactor < 0 || limits.retry.jitterFactor > 1) {
    throw new Error('Jitter factor must be between 0 and 1');
  }

  // Validate policy limits
  if (limits.policy.codeBlockThreshold < 1) {
    throw new Error('Code block threshold must be at least 1');
  }
}

// Validate default limits on module load
validateLimits(DEFAULT_LIMITS);
