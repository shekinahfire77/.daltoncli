/**
 * Retry Logic with Exponential Backoff
 *
 * This module provides a robust retry mechanism with exponential backoff for handling
 * transient failures in API calls and other operations. It supports:
 * - Configurable retry attempts
 * - Exponential backoff with jitter
 * - Custom retry conditions
 * - Error categorization
 *
 * @module core/retry_logic
 */

import { getRetryConfig, RetryConfig } from './app_limits';

/**
 * Error categories for retry decisions
 */
export enum ErrorCategory {
  /** Network errors (connection refused, timeouts, DNS failures) */
  NETWORK = 'network',

  /** Rate limiting errors (HTTP 429, quota exceeded) */
  RATE_LIMIT = 'rate_limit',

  /** Authentication errors (HTTP 401, 403, invalid credentials) */
  AUTHENTICATION = 'authentication',

  /** Server errors (HTTP 500, 502, 503, 504) */
  SERVER_ERROR = 'server_error',

  /** Client errors (HTTP 400, invalid input) */
  CLIENT_ERROR = 'client_error',

  /** Unknown or uncategorized errors */
  UNKNOWN = 'unknown',
}

/**
 * Options for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (overrides config) */
  maxRetries?: number;

  /** Initial delay before first retry in ms (overrides config) */
  initialDelay?: number;

  /** Maximum delay between retries in ms (overrides config) */
  maxDelay?: number;

  /** Backoff multiplier for exponential backoff (overrides config) */
  backoffMultiplier?: number;

  /** Jitter factor to add randomness 0-1 (overrides config) */
  jitterFactor?: number;

  /** Custom function to determine if error should be retried */
  shouldRetry?: (error: Error, category: ErrorCategory) => boolean;

  /** Callback invoked before each retry attempt */
  onRetry?: (attempt: number, delay: number, error: Error) => void;
}

/**
 * Retry context provided to callbacks
 */
export interface RetryContext {
  /** Current attempt number (1-based) */
  attempt: number;

  /** Total number of attempts allowed */
  maxAttempts: number;

  /** Delay before this retry in ms */
  delay: number;

  /** Last error that triggered the retry */
  lastError: Error;

  /** Category of the error */
  errorCategory: ErrorCategory;
}

/**
 * Result of a retry operation
 */
export interface RetryResult<T> {
  /** Whether the operation succeeded */
  success: boolean;

  /** Result value if successful */
  value?: T;

  /** Final error if all retries failed */
  error?: Error;

  /** Number of attempts made */
  attempts: number;

  /** Total time spent including delays (ms) */
  totalTime: number;
}

/**
 * Categorizes an error based on its message and properties
 * @param error - The error to categorize
 * @returns The error category
 */
export function categorizeError(error: Error): ErrorCategory {
  const message = error.message.toLowerCase();

  // Network errors
  const networkKeywords = [
    'network',
    'connection',
    'timeout',
    'econnrefused',
    'enotfound',
    'etimedout',
    'fetch failed',
    'socket',
    'dns',
  ];

  if (networkKeywords.some((keyword) => message.includes(keyword))) {
    return ErrorCategory.NETWORK;
  }

  // Rate limiting
  const rateLimitKeywords = ['rate limit', 'too many requests', 'quota exceeded', '429'];

  if (rateLimitKeywords.some((keyword) => message.includes(keyword))) {
    return ErrorCategory.RATE_LIMIT;
  }

  // Authentication
  const authKeywords = [
    'authentication',
    'unauthorized',
    'forbidden',
    'api key',
    'invalid key',
    'credential',
    '401',
    '403',
  ];

  if (authKeywords.some((keyword) => message.includes(keyword))) {
    return ErrorCategory.AUTHENTICATION;
  }

  // Server errors
  const serverErrorKeywords = [
    '500',
    '502',
    '503',
    '504',
    'internal server error',
    'bad gateway',
    'service unavailable',
    'gateway timeout',
  ];

  if (serverErrorKeywords.some((keyword) => message.includes(keyword))) {
    return ErrorCategory.SERVER_ERROR;
  }

  // Client errors
  const clientErrorKeywords = ['400', 'bad request', 'invalid', 'validation'];

  if (clientErrorKeywords.some((keyword) => message.includes(keyword))) {
    return ErrorCategory.CLIENT_ERROR;
  }

  return ErrorCategory.UNKNOWN;
}

/**
 * Default retry policy - determines which errors should be retried
 * @param error - The error to evaluate
 * @param category - The error category
 * @returns true if the error should be retried
 */
export function defaultShouldRetry(error: Error, category: ErrorCategory): boolean {
  // Retry network errors, rate limits, and server errors
  return (
    category === ErrorCategory.NETWORK ||
    category === ErrorCategory.RATE_LIMIT ||
    category === ErrorCategory.SERVER_ERROR
  );
}

/**
 * Calculates the delay before the next retry attempt using exponential backoff with jitter
 * @param attempt - Current attempt number (0-based)
 * @param config - Retry configuration
 * @returns Delay in milliseconds
 */
export function calculateBackoffDelay(attempt: number, config: RetryConfig): number {
  // Exponential backoff: initialDelay * (backoffMultiplier ^ attempt)
  const exponentialDelay = config.initialDelay * Math.pow(config.backoffMultiplier, attempt);

  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, config.maxDelay);

  // Add jitter to prevent thundering herd
  // Jitter range: [delay * (1 - jitter), delay * (1 + jitter)]
  const jitterRange = cappedDelay * config.jitterFactor;
  const jitter = Math.random() * 2 * jitterRange - jitterRange;

  const finalDelay = Math.max(0, cappedDelay + jitter);

  return Math.floor(finalDelay);
}

/**
 * Sleeps for the specified duration
 * @param ms - Milliseconds to sleep
 * @returns Promise that resolves after the delay
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executes an operation with automatic retry using exponential backoff
 *
 * @template T - Return type of the operation
 * @param operation - Async function to execute
 * @param options - Retry options (overrides defaults from config)
 * @returns Promise resolving to the operation result
 * @throws The last error if all retries are exhausted and operation fails
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   async () => {
 *     return await fetch('https://api.example.com/data');
 *   },
 *   {
 *     maxRetries: 3,
 *     onRetry: (attempt, delay, error) => {
 *       console.log(`Retry attempt ${attempt} after ${delay}ms due to: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  // Get configuration with overrides
  const config = getRetryConfig();

  const maxRetries = options.maxRetries ?? config.maxRetries;
  const retryConfig: RetryConfig = {
    maxRetries,
    initialDelay: options.initialDelay ?? config.initialDelay,
    maxDelay: options.maxDelay ?? config.maxDelay,
    backoffMultiplier: options.backoffMultiplier ?? config.backoffMultiplier,
    jitterFactor: options.jitterFactor ?? config.jitterFactor,
  };

  const shouldRetry = options.shouldRetry ?? defaultShouldRetry;
  const startTime = Date.now();

  let lastError: Error = new Error('Unknown error');
  let attempt = 0;

  while (attempt <= maxRetries) {
    try {
      // Execute the operation
      const result = await operation();
      return result;
    } catch (error) {
      // Convert to Error if not already
      lastError = error instanceof Error ? error : new Error(String(error));

      // Categorize the error
      const category = categorizeError(lastError);

      // Check if we should retry
      const willRetry = attempt < maxRetries && shouldRetry(lastError, category);

      if (!willRetry) {
        // No more retries, throw the error
        throw lastError;
      }

      // Calculate backoff delay
      const delay = calculateBackoffDelay(attempt, retryConfig);

      // Invoke callback if provided
      if (options.onRetry) {
        options.onRetry(attempt + 1, delay, lastError);
      }

      // Wait before retrying
      await sleep(delay);

      attempt++;
    }
  }

  // This should never be reached due to throw in catch block, but TypeScript needs it
  throw lastError;
}

/**
 * Executes an operation with retry and returns detailed result information
 * instead of throwing on failure
 *
 * @template T - Return type of the operation
 * @param operation - Async function to execute
 * @param options - Retry options
 * @returns Promise resolving to RetryResult with success status and value/error
 *
 * @example
 * ```typescript
 * const result = await retryWithResult(async () => {
 *   return await fetchData();
 * });
 *
 * if (result.success) {
 *   console.log('Success:', result.value);
 * } else {
 *   console.error('Failed after', result.attempts, 'attempts:', result.error);
 * }
 * ```
 */
export async function retryWithResult<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const startTime = Date.now();
  let attempts = 0;

  try {
    const value = await withRetry(
      async () => {
        attempts++;
        return await operation();
      },
      {
        ...options,
        onRetry: (attempt, delay, error) => {
          attempts = attempt + 1;
          if (options.onRetry) {
            options.onRetry(attempt, delay, error);
          }
        },
      }
    );

    return {
      success: true,
      value,
      attempts: attempts || 1,
      totalTime: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error : new Error(String(error)),
      attempts: attempts || 1,
      totalTime: Date.now() - startTime,
    };
  }
}
