import { ERROR_MESSAGES, formatErrorMessage, TOOL_CONSTANTS } from '../core/Constants';
import { ProviderConfig } from '../core/schemas'; // Import ProviderConfig from schemas

/**
 * Abstract base class for AI providers
 * Consolidates common initialization, validation, and error handling patterns
 * across OpenAI, Gemini, and Mistral providers
 *
 * DEFENSIVE: Includes comprehensive error handling and validation
 */
export abstract class BaseAIProvider {
  /**
   * Name of the provider (e.g., 'openai', 'gemini', 'mistral')
   * Protected to allow subclasses to access and use it in error messages
   */
  public providerName: string;
  protected config: ProviderConfig; // Store the provider-specific config

  constructor(providerName: string, config: ProviderConfig) {
    this.providerName = providerName;
    this.config = config;
  }

  /**
   * Common error handling for provider initialization failures
   * DEFENSIVE: Wraps and provides context for client creation errors
   *
   * @param error - The error that occurred during initialization
   * @param providerName - Name of the provider for error message context
   * @throws Error with wrapped message and context
   */
  protected handleInitializationError(error: unknown, providerName: string): never {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_ERROR;
    throw new Error(formatErrorMessage(ERROR_MESSAGES.CLIENT_INIT_FAILURE, {
      provider: providerName,
      error: message,
    }));
  }

  /**
   * Validates timeout value is within safe bounds
   * Can be overridden by subclasses with provider-specific limits
   * DEFENSIVE: Ensures timeout is a valid number within configured bounds
   *
   * @param timeout - The timeout value in milliseconds
   * @param minMs - Minimum acceptable timeout in milliseconds
   * @param maxMs - Maximum acceptable timeout in milliseconds
   * @returns number - The validated timeout value
   * @throws Error if timeout is invalid or outside bounds
   */
  protected validateTimeout(timeout: number | undefined, minMs: number, maxMs: number, defaultMs: number): number {
    if (timeout === undefined) {
      return defaultMs;
    }

    if (typeof timeout !== 'number' || isNaN(timeout)) {
      throw new Error(formatErrorMessage(ERROR_MESSAGES.INVALID_TIMEOUT_VALUE, {
        value: String(timeout),
      }));
    }

    if (timeout < minMs) {
      throw new Error(formatErrorMessage(ERROR_MESSAGES.TIMEOUT_TOO_SHORT, {
        value: timeout,
        min: minMs,
      }));
    }

    if (timeout > maxMs) {
      throw new Error(formatErrorMessage(ERROR_MESSAGES.TIMEOUT_TOO_LONG, {
        value: timeout,
        max: maxMs,
      }));
    }

    return timeout;
  }

  /**
   * Validates messages array has required structure
   * Subclasses may need to override for provider-specific message formats
   * DEFENSIVE: Validates array and each message object structure
   *
   * @param messages - The messages array to validate
   * @throws Error if messages array is invalid or malformed
   */
  protected validateMessagesStructure(messages: unknown): void {
    if (!Array.isArray(messages)) {
      throw new Error(ERROR_MESSAGES.MESSAGES_NOT_ARRAY);
    }

    if (messages.length === 0) {
      throw new Error(ERROR_MESSAGES.MESSAGES_EMPTY);
    }

    // Validate each message has required structure
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || typeof msg !== 'object') {
        throw new Error(formatErrorMessage(ERROR_MESSAGES.MESSAGE_AT_INDEX_INVALID, {
          index: i,
        }));
      }

      // All messages must have a role
      if (!('role' in msg)) {
        throw new Error(formatErrorMessage(ERROR_MESSAGES.MESSAGE_MISSING_ROLE, {
          index: i,
        }));
      }
    }
  }

  /**
   * Validates options object has required fields
   * Subclasses may override or extend for provider-specific validation
   * DEFENSIVE: Checks options structure and required fields
   *
   * @param options - The options object to validate
   * @throws Error if options are invalid or missing required fields
   */
  protected validateOptionsStructure(options: Record<string, unknown>): void {
    if (!options || typeof options !== 'object') {
      throw new Error(ERROR_MESSAGES.OPTIONS_INVALID);
    }

    if (typeof options.model !== 'string' || !String(options.model).trim()) {
      throw new Error(ERROR_MESSAGES.MODEL_NOT_SPECIFIED);
    }

    // Validate tools if provided
    if (options.tools !== undefined && !Array.isArray(options.tools)) {
      throw new Error(ERROR_MESSAGES.TOOLS_NOT_ARRAY);
    }

    // Validate tool_choice if provided
    if (options.tool_choice !== undefined) {
      const isValidChoice = 
        (typeof options.tool_choice === 'string' && TOOL_CONSTANTS.VALID_TOOL_CHOICES.includes(options.tool_choice as 'none' | 'auto')) ||
        (typeof options.tool_choice === 'object' && options.tool_choice !== null);

      if (!isValidChoice) {
        throw new Error(ERROR_MESSAGES.INVALID_TOOL_CHOICE);
      }
    }
  }

  /**
   * Wraps validation errors with provider context
   * DEFENSIVE: Ensures all validation errors have consistent formatting
   *
   * @param error - The validation error that occurred
   * @param context - Additional context for the error message
   * @throws Error with wrapped message
   */
  protected wrapValidationError(error: unknown, context: string): never {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.UNKNOWN_VALIDATION_ERROR;
    throw new Error(formatErrorMessage(ERROR_MESSAGES.VALIDATION_ERROR_CONTEXT, {
      context,
      error: message,
    }));
  }

  /**
   * Cleans up any resources held by the provider
   * Subclasses should override to clean up their specific resources
   * DEFENSIVE: Should be called when provider is no longer needed
   */
  public cleanup(): void {
    // Base implementation does nothing - override in subclasses
  }

  /**
   * Destructor-like cleanup
   * Note: JavaScript doesn't have true destructors, so this must be called explicitly
   * Subclasses may override for additional cleanup
   */
  public destroy(): void {
    this.cleanup();
  }
}
