/**
 * Application-wide string constants and configuration values
 *
 * This module centralizes all hardcoded string constants and configuration values
 * that were previously scattered throughout the codebase. This provides:
 * - Single source of truth for string constants
 * - Easy updates to configuration without editing multiple files
 * - Consistent messaging across the application
 * - Clear identification of what values are configurable
 *
 * @module core/Constants
 */

/**
 * Azure OpenAI endpoint patterns
 * Used to detect Azure OpenAI endpoints vs standard OpenAI endpoints
 */
export const AZURE_PATTERNS = {
  /** Azure OpenAI domain pattern */
  OPENAI_AZURE_COM: '.openai.azure.com',

  /** Azure Cognitive Services domain pattern */
  COGNITIVE_SERVICES_AZURE_COM: '.cognitiveservices.azure.com',
} as const;

/**
 * Azure OpenAI API defaults
 */
export const AZURE_DEFAULTS = {
  /** Default Azure API version to use if not specified */
  DEFAULT_API_VERSION: '2024-12-01-preview',

  /** Path component for deployment endpoints */
  DEPLOYMENT_PATH: '/openai/deployments/',

  /** Query parameter key for API version */
  API_VERSION_PARAM: 'api-version',

  /** Header key for Azure API key */
  API_KEY_HEADER: 'api-key',
} as const;

/**
 * Common error messages used throughout the application
 */
export const ERROR_MESSAGES = {
  // Configuration errors
  CONFIG_READ_FAILURE: 'Failed to read configuration for {provider}: {error}',
  CONFIG_MISSING: 'Configuration is missing for {provider}',
  PROVIDER_NOT_CONFIGURED: '{provider} provider configuration not found. Use \'dalton-cli configure ai set {provider} api_key <key>\'',
  API_KEY_NOT_CONFIGURED: '{provider} API key not configured. Use \'dalton-cli configure ai set {provider} api_key <key>\'',

  // Client initialization errors
  CLIENT_INIT_FAILURE: 'Failed to initialize {provider} client: {error}',

  // Validation errors
  INVALID_TIMEOUT_VALUE: 'Invalid timeout value: {value}. Must be a number in milliseconds',
  TIMEOUT_TOO_SHORT: 'Timeout too short: {value}ms. Minimum is {min}ms',
  TIMEOUT_TOO_LONG: 'Timeout too long: {value}ms. Maximum is {max}ms',
  TIMEOUT_UNSPECIFIED: 'Timeout must be specified',

  // Messages validation
  MESSAGES_NOT_ARRAY: 'Messages must be an array',
  MESSAGES_EMPTY: 'Messages array cannot be empty',
  MESSAGE_AT_INDEX_INVALID: 'Message at index {index} is invalid',
  MESSAGE_MISSING_ROLE: 'Message at index {index} is missing required field: role',

  // Options validation
  OPTIONS_INVALID: 'Options must be a valid object',
  MODEL_NOT_SPECIFIED: 'Model must be specified as a non-empty string',
  TOOLS_NOT_ARRAY: 'Tools must be an array if provided',
  INVALID_TOOL_CHOICE: 'Invalid tool_choice value',

  // Validation wrapper
  VALIDATION_ERROR_CONTEXT: '{context}: {error}',
  UNKNOWN_VALIDATION_ERROR: 'Unknown validation error',

  // Stream and processing errors
  STREAM_CHUNK_ERROR: 'Error processing {provider} stream chunk: {error}',
  UNKNOWN_ERROR_PROCESSING_CHUNK: 'Unknown error processing chunk',
  UNKNOWN_ERROR_TRANSFORMING_MESSAGES: 'Unknown error transforming messages',
  UNKNOWN_TIMEOUT_ERROR: 'Unknown timeout error',
  UNKNOWN_ERROR: 'Unknown error',
  UNKNOWN_ERROR_READING_CONFIG: 'Unknown error reading configuration',

  // Request errors
  REQUEST_TIMEOUT: '{provider} request timed out after {timeout}ms',
  REQUEST_ABORTED: 'Request was aborted',
  REQUEST_FAILED: '{provider} API request failed: {error}',
} as const;

/**
 * Default model names across different providers
 * These are fallback model names if not specified in configuration
 */
export const DEFAULT_MODELS = {
  /** Default OpenAI model */
  OPENAI: 'gpt-4',

  /** Default Google Gemini model */
  GEMINI: 'gemini-pro',

  /** Default Mistral model */
  MISTRAL: 'mistral-large',
} as const;

/**
 * Provider names for consistent reference
 */
export const PROVIDER_NAMES = {
  OPENAI: 'openai',
  GEMINI: 'gemini',
  MISTRAL: 'mistral',
} as const;

/**
 * Configuration keys for accessing provider settings
 */
export const CONFIG_KEYS = {
  /** API key configuration key */
  API_KEY: 'api_key',

  /** API endpoint configuration key */
  API_ENDPOINT: 'api_endpoint',

  /** Azure-specific: Deployment name */
  DEPLOYMENT_NAME: 'deployment_name',

  /** Azure-specific: API version */
  API_VERSION: 'api_version',
} as const;

/**
 * Tool-related constants
 */
export const TOOL_CONSTANTS = {
  /** Tool choice value for no tool usage */
  TOOL_CHOICE_NONE: 'none',

  /** Tool choice value for automatic tool selection */
  TOOL_CHOICE_AUTO: 'auto',

  /** Valid tool choice values */
  VALID_TOOL_CHOICES: ['none', 'auto'] as const,
} as const;

/**
 * Chat and session related string constants
 */
export const CHAT_CONSTANTS = {
  /** Message role for system messages */
  ROLE_SYSTEM: 'system',

  /** Message role for user messages */
  ROLE_USER: 'user',

  /** Message role for assistant messages */
  ROLE_ASSISTANT: 'assistant',

  /** Valid message roles */
  VALID_ROLES: ['system', 'user', 'assistant'] as const,

  /** Session load cancelled message */
  SESSION_LOAD_CANCELLED: 'Session load cancelled.',

  /** Session load confirmation message template */
  SESSION_LOAD_PROMPT: 'This session has {messageCount} messages. Continue loading?',
} as const;

/**
 * Utility function to format error messages
 * Replaces {placeholder} patterns with provided values
 *
 * @param template - The error message template with {placeholder} patterns
 * @param values - Object mapping placeholder names to their values
 * @returns Formatted error message
 *
 * @example
 * const msg = formatErrorMessage(ERROR_MESSAGES.CONFIG_READ_FAILURE, {
 *   provider: 'openai',
 *   error: 'API key not found'
 * });
 * // Result: "Failed to read configuration for openai: API key not found"
 */
export function formatErrorMessage(template: string, values: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value));
  }
  return result;
}
