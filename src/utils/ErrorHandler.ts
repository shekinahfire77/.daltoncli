/**
 * ErrorHandler Utility Module
 *
 * Consolidates duplicate error handling patterns used throughout the application.
 * Provides a unified interface for extracting, categorizing, formatting, and logging errors.
 *
 * This module reduces repetitive code like:
 *   const errorMsg = error instanceof Error ? error.message : 'Unknown error';
 *   const { category, suggestion } = categorizeError(error);
 *   console.error(formatError(category, `Failed to X: ${errorMsg}`, suggestion));
 *
 * Into a single call:
 *   ErrorHandler.logAndFormat(error, 'Failed to X');
 */

import chalk from 'chalk';

// Type definitions for error categorization
interface ErrorCategory {
  category: string;
  suggestion: string;
}

/**
 * Extracts the error message from an Error object or unknown error type
 *
 * Safely extracts error messages from various error types:
 * - Error instances: uses .message property
 * - NodeJS.ErrnoException: uses .message property
 * - Unknown types: returns 'Unknown error' fallback
 *
 * @param error - The error to extract message from (can be any type)
 * @returns A string containing the error message or 'Unknown error'
 *
 * @example
 * try {
 *   fs.readFileSync('nonexistent.txt');
 * } catch (error) {
 *   const msg = ErrorHandler.extractMessage(error);
 *   console.log(msg); // "ENOENT: no such file or directory..."
 * }
 */
export const extractMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error';
};

/**
 * Categorizes errors and provides actionable user guidance
 *
 * Examines error properties and error codes to classify them into helpful categories
 * with specific suggestions for resolution. Supports:
 * - Custom SessionError instances
 * - Node.js filesystem error codes (EACCES, ENOENT, ENOSPC, etc.)
 * - Generic unknown errors
 *
 * @param error - The error to categorize (can be any type)
 * @returns Object with category name and user-facing suggestion string
 *
 * @example
 * try {
 *   fs.mkdirSync('/root/forbidden');
 * } catch (error) {
 *   const { category, suggestion } = ErrorHandler.categorizeError(error);
 *   console.log(category);  // "PERMISSION DENIED"
 *   console.log(suggestion); // "Check file permissions or run with appropriate access rights."
 * }
 */
export const categorizeError = (error: unknown): ErrorCategory => {
  // Check for custom SessionError (imported from chat.ts context)
  if (error instanceof Error && error.name === 'SessionError') {
    return {
      category: 'SESSION ERROR',
      suggestion: 'Try using --list-sessions to see available sessions or check the session directory.'
    };
  }

  // Extract error code from NodeJS.ErrnoException types
  const errCode = (error as NodeJS.ErrnoException)?.code;

  // Permission denied errors
  if (errCode === 'EACCES') {
    return {
      category: 'PERMISSION DENIED',
      suggestion: 'Check file permissions or run with appropriate access rights.'
    };
  }

  // File not found errors
  if (errCode === 'ENOENT') {
    return {
      category: 'FILE NOT FOUND',
      suggestion: 'Verify the session exists using --list-sessions.'
    };
  }

  // Disk space errors
  if (errCode === 'ENOSPC') {
    return {
      category: 'DISK SPACE FULL',
      suggestion: 'Free up disk space and try again.'
    };
  }

  // Default for unclassified errors
  return {
    category: 'UNKNOWN ERROR',
    suggestion: 'Check your configuration and try again.'
  };
};

/**
 * Formats an error message with category and actionable suggestions
 *
 * Creates a visually formatted error message with:
 * - Red error category header with emoji
 * - Error message content
 * - Yellow actionable suggestion
 *
 * @param category - Error category label (e.g., "CONNECTION ERROR", "AUTHENTICATION ERROR")
 * @param message - The detailed error message
 * @param suggestion - Actionable suggestion for the user
 * @returns Formatted multi-line error string with chalk colors
 *
 * @example
 * const formatted = ErrorHandler.formatError(
 *   'NETWORK ERROR',
 *   'Failed to connect to API',
 *   'Check your internet connection and try again.'
 * );
 * console.error(formatted);
 * // Output:
 * // ❌ NETWORK ERROR
 * //    Failed to connect to API
 * //    💡 Suggestion: Check your internet connection and try again.
 */
export const formatError = (category: string, message: string, suggestion: string): string => {
  const header = chalk.bold.red(`❌ ${category}`);
  const msg = chalk.red(`   ${message}`);
  const hint = chalk.yellow(`   💡 Suggestion: ${suggestion}`);
  return `${header}\n${msg}\n${hint}`;
};

/**
 * Logs and formats error in a single call
 *
 * Combines extraction, categorization, formatting, and logging into one operation.
 * This is the primary convenience function that consolidates the most common
 * error handling pattern used throughout the application.
 *
 * Pattern replaced:
 *   const errorMsg = error instanceof Error ? error.message : 'Unknown error';
 *   const { category, suggestion } = categorizeError(error);
 *   console.error(formatError(category, `Failed to X: ${errorMsg}`, suggestion));
 *
 * New pattern:
 *   ErrorHandler.logAndFormat(error, 'Failed to X');
 *
 * @param error - The error to handle (can be any type)
 * @param operationName - Human-readable description of what operation failed (e.g., "Failed to save session")
 * @returns void - Logs directly to console.error
 *
 * @example
 * try {
 *   saveSession(data);
 * } catch (error) {
 *   ErrorHandler.logAndFormat(error, 'Failed to save session');
 * }
 * // Output (on error):
 * // ❌ UNKNOWN ERROR
 * //    Failed to save session: ENOSPC: no space left on device
 * //    💡 Suggestion: Check your configuration and try again.
 */
export const logAndFormat = (error: unknown, operationName: string): void => {
  const errorMsg = extractMessage(error);
  const { category, suggestion } = categorizeError(error);
  const fullMessage = `${operationName}: ${errorMsg}`;
  console.error(formatError(category, fullMessage, suggestion));
};

/**
 * ErrorHandler namespace/export object
 *
 * Exports all error handling utilities for convenient access:
 *   import { ErrorHandler } from '../utils/ErrorHandler';
 *   ErrorHandler.logAndFormat(error, 'Failed to X');
 *
 * Or use named imports for tree-shaking:
 *   import { logAndFormat, extractMessage } from '../utils/ErrorHandler';
 */
export const ErrorHandler = {
  extractMessage,
  categorizeError,
  formatError,
  logAndFormat,
};

// Export as default as well for flexibility
export default ErrorHandler;
