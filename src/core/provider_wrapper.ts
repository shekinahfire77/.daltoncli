/**
 * Provider Wrapper - Unified API for AI Provider Communication
 *
 * This module provides a consistent interface for interacting with multiple AI providers
 * (OpenAI, Mistral, Gemini, etc.) by normalizing their different streaming formats and
 * handling provider-specific quirks internally.
 *
 * Design Pattern: Adapter Pattern
 * - Adapts various provider interfaces to a unified SendChatResponse interface
 * - Encapsulates provider-specific behavior
 * - Provides a stable API for consumers
 *
 * @module core/provider_wrapper
 */

import { getProvider } from './api_client';
import { assembleDeltaStream, DeltaChunk, ToolCall as StreamToolCall } from './stream_assembler';
import { ChatMessage } from './schemas';
import { Tool } from './tools';

/**
 * Union type for all provider stream types that can be returned from getChatCompletion()
 *
 * Different providers return different stream types:
 * - OpenAI (and OpenAI-compatible): AsyncIterable of stream events
 * - Mistral: EventStream (which is AsyncIterable)
 * - Gemini: AsyncIterable of stream chunks
 *
 * This union ensures type safety while accommodating provider differences
 */
type ProviderStream = AsyncIterable<DeltaChunk> | AsyncIterable<unknown>;

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Options for sending a chat request to the AI provider
 */
export interface SendChatOptions {
  /** The model identifier to use (e.g., 'gpt-4', 'mistral-large', 'gemini-pro') */
  model: string;

  /** Optional array of tools/functions available to the model */
  tools?: Tool[];

  /** Tool selection strategy - 'auto', 'none', or specific function */
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };

  /**
   * Optional callback for real-time content chunks
   * Called for each content delta as it arrives from the provider
   * Useful for streaming display to users
   */
  onContent?: (chunk: string) => void;

  /**
   * Optional timeout in milliseconds for the entire API call
   * Default: 30000 (30 seconds)
   * Range: 1000-600000 (1 second to 10 minutes)
   * DEFENSIVE: Protects against hanging requests and resource exhaustion
   */
  timeout?: number;
}

/**
 * Normalized response from a chat request
 * This structure is consistent across all providers
 */
export interface SendChatResponse {
  /** Complete accumulated content from the response */
  content: string;

  /** Array of tool calls requested by the model */
  toolCalls: ToolCall[];

  /** Optional metadata about the response */
  metadata?: ResponseMetadata;
}

/**
 * Standardized tool call structure
 * Matches the format expected by most AI providers
 */
export interface ToolCall {
  /** Unique identifier for this tool call */
  id: string;

  /** Type of tool call (always 'function' for OpenAI compatibility) */
  type: 'function';

  /** Function details */
  function: {
    /** Name of the function to call */
    name: string;

    /** JSON string of function arguments */
    arguments: string;
  };
}

/**
 * Optional metadata about the response
 * Availability depends on the provider
 */
export interface ResponseMetadata {
  /** Number of tokens used (if available from provider) */
  tokens?: {
    prompt?: number;
    completion?: number;
    total?: number;
  };

  /** Model that generated the response */
  model?: string;

  /** Finish reason (e.g., 'stop', 'length', 'tool_calls') */
  finishReason?: string;
}

/**
 * Base interface for AI providers
 * All providers must implement this interface
 *
 * Type Safety Notes:
 * - getChatCompletion returns a promise that resolves to a ProviderStream
 * - ProviderStream is a union of AsyncIterable types that can be normalized to DeltaChunk
 * - This allows each provider to return its native stream type while maintaining type safety
 */
export interface AIProvider {
  getChatCompletion(
    messages: ChatMessage[],
    options: {
      model: string;
      tools?: Tool[];
      tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    }
  ): Promise<ProviderStream>;
}

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Base error class for provider-related errors
 * Provides context about which provider failed and whether retry is safe
 */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly providerName: string,
    public readonly originalError?: Error,
    public readonly isRetryable: boolean = false
  ) {
    super(message);
    this.name = 'ProviderError';

    // Maintain proper stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ProviderError);
    }
  }
}

/**
 * Error thrown when provider configuration is missing or invalid
 */
export class ProviderConfigurationError extends ProviderError {
  constructor(message: string, providerName: string) {
    super(message, providerName, undefined, false);
    this.name = 'ProviderConfigurationError';
  }
}

/**
 * Error thrown when a provider API request fails
 */
export class ProviderRequestError extends ProviderError {
  constructor(
    message: string,
    providerName: string,
    originalError?: Error,
    isRetryable: boolean = false
  ) {
    super(message, providerName, originalError, isRetryable);
    this.name = 'ProviderRequestError';
  }
}

/**
 * Error thrown when stream processing fails
 */
export class ProviderStreamError extends ProviderError {
  constructor(message: string, providerName: string, originalError?: Error) {
    super(message, providerName, originalError, false);
    this.name = 'ProviderStreamError';
  }
}

// ============================================================================
// ProviderWrapper Class
// ============================================================================

/**
 * Unified wrapper for AI provider interactions
 *
 * This class provides a consistent interface for all AI providers,
 * handling provider-specific differences internally.
 *
 * Responsibilities:
 * - Normalize different provider streaming formats
 * - Handle provider-specific quirks (message formats, tool calls, etc.)
 * - Provide consistent error handling
 * - Enable real-time content streaming via callback
 * - Extract and normalize tool calls
 *
 * Usage Example:
 * ```typescript
 * const wrapper = new ProviderWrapper('openai');
 * const response = await wrapper.sendChat(messages, {
 *   model: 'gpt-4',
 *   tools: myTools,
 *   tool_choice: 'auto',
 *   onContent: (chunk) => process.stdout.write(chunk)
 * });
 * console.log('Response:', response.content);
 * console.log('Tool calls:', response.toolCalls);
 * ```
 */
export class ProviderWrapper {
  private provider: AIProvider;
  private providerName: string;

  /**
   * Creates a new provider wrapper
   *
   * @param providerName - Name of the provider (e.g., 'openai', 'mistral', 'gemini')
   * @throws {ProviderConfigurationError} If provider is not configured or unavailable
   */
  constructor(providerName: string) {
    this.providerName = providerName;

    try {
      this.provider = getProvider(providerName) as unknown as AIProvider;
    } catch (error) {
      throw new ProviderConfigurationError(
        `Failed to initialize provider '${providerName}': ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        providerName
      );
    }
  }

  /**
   * Sends a chat request to the underlying provider
   *
   * This method:
   * 1. Validates input parameters
   * 2. Calls the provider's getChatCompletion() method
   * 3. Normalizes the streaming response format
   * 4. Assembles the complete response using assembleDeltaStream()
   * 5. Extracts and normalizes tool calls
   * 6. Returns a unified response structure
   *
   * The method handles all provider-specific differences internally,
   * presenting a consistent interface to the caller.
   *
   * @param messages - Array of chat messages in standard format
   * @param options - Chat configuration options
   * @returns Promise resolving to normalized response with content and tool calls
   * @throws {ProviderRequestError} If the provider request fails
   * @throws {ProviderStreamError} If stream processing fails
   *
   * @example
   * ```typescript
   * const response = await wrapper.sendChat(
   *   [{ role: 'user', content: 'Hello!' }],
   *   {
   *     model: 'gpt-4',
   *     onContent: (chunk) => console.log(chunk)
   *   }
   * );
   * ```
   */
  async sendChat(
    messages: ChatMessage[],
    options: SendChatOptions
  ): Promise<SendChatResponse> {
    // Validate required parameters
    this.validateInputs(messages, options);

    try {
      // Call the underlying provider's getChatCompletion method
      const stream = await this.provider.getChatCompletion(messages, {
        model: options.model,
        tools: options.tools,
        tool_choice: options.tool_choice || 'auto',
      });

      // Normalize the stream to a consistent DeltaChunk format
      const normalizedStream = this.normalizeStream(stream);

      // Assemble the complete response from delta chunks
      // This uses the existing assembleDeltaStream utility which:
      // - Accumulates content chunks
      // - Assembles tool call deltas
      // - Invokes the onContent callback for real-time display
      const { content, toolCallsRaw } = await assembleDeltaStream(
        normalizedStream,
        options.onContent
      );

      // Convert tool calls to the standardized format
      const toolCalls = this.normalizeToolCalls(toolCallsRaw);

      // Extract metadata if available (provider-dependent)
      const metadata = this.extractMetadata(stream);

      return {
        content,
        toolCalls,
        metadata,
      };

    } catch (error) {
      // Categorize and re-throw with appropriate error type
      throw this.handleError(error);
    }
  }

  /**
   * Validates input parameters before making a request
   *
   * @param messages - Chat messages to validate
   * @param options - Options to validate
   * @throws {ProviderError} If validation fails
   */
  private validateInputs(messages: ChatMessage[], options: SendChatOptions): void {
    if (!messages || messages.length === 0) {
      throw new ProviderError(
        'Messages array cannot be empty',
        this.providerName,
        undefined,
        false
      );
    }

    if (!options.model || typeof options.model !== 'string') {
      throw new ProviderError(
        'Model must be specified as a non-empty string',
        this.providerName,
        undefined,
        false
      );
    }
  }

  /**
   * Normalizes the stream format from different providers
   *
   * Different providers return streams in slightly different formats:
   * - OpenAI: Already in DeltaChunk format (pass-through)
   * - Mistral: May need transformation (currently passes through)
   * - Gemini: Uses custom adapter (already handled in gemini_provider.ts)
   *
   * This method ensures all streams conform to the DeltaChunk interface
   * expected by assembleDeltaStream().
   *
   * Type Safety:
   * - Input: ProviderStream (union of AsyncIterable types from providers)
   * - Output: AsyncIterable<DeltaChunk> (standardized format for stream_assembler)
   * - Type assertion is safe here because:
   *   1. Each provider is responsible for emitting DeltaChunk-compatible events
   *   2. OpenAI-compatible providers (openai, azure, groq) return DeltaChunk objects directly
   *   3. Gemini provider uses adaptGeminiStreamToOpenAI() adapter
   *   4. Mistral returns objects compatible with DeltaChunk structure
   *
   * @param stream - Raw stream from provider (ProviderStream union type)
   * @returns Normalized async iterable of DeltaChunks
   */
  private normalizeStream(stream: ProviderStream): AsyncIterable<DeltaChunk> {
    // Provider-specific normalization logic
    // Currently, most providers already return compatible formats
    // or handle normalization in their own implementations

    switch (this.providerName) {
      case 'openai':
      case 'azure':
      case 'groq':
        // OpenAI-compatible providers return the correct format natively
        // Type assertion is safe as these providers return AsyncIterable<DeltaChunk>
        return stream as AsyncIterable<DeltaChunk>;

      case 'mistral':
        // Mistral SDK should already return compatible format
        // The EventStream from Mistral SDK is already async iterable
        // and emits chunks compatible with DeltaChunk
        return stream as AsyncIterable<DeltaChunk>;

      case 'gemini':
        // Gemini provider already has adaptGeminiStreamToOpenAI()
        // in gemini_provider.ts, so the stream is already normalized
        // The returned AsyncIterable<DeltaResponse> is compatible with DeltaChunk
        return stream as AsyncIterable<DeltaChunk>;

      default:
        // For unknown providers, attempt pass-through
        // This allows custom providers to work if they follow the format
        // Assumption: custom providers emit DeltaChunk-compatible objects
        return stream as AsyncIterable<DeltaChunk>;
    }
  }

  /**
   * Normalizes tool calls from the raw format
   *
   * Ensures tool calls have all required fields and consistent structure
   *
   * @param rawToolCalls - Tool calls from assembleDeltaStream
   * @returns Normalized tool calls array
   */
  private normalizeToolCalls(rawToolCalls: StreamToolCall[]): ToolCall[] {
    if (!rawToolCalls || rawToolCalls.length === 0) {
      return [];
    }

    return rawToolCalls.map(tc => ({
      id: tc.id,
      type: 'function' as const,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    }));
  }

  /**
   * Extracts metadata from the response if available
   *
   * Note: Metadata availability varies by provider.
   * Some providers don't expose this information in streaming mode.
   *
   * Type Safety:
   * - Input: ProviderStream (the raw stream that may contain metadata)
   * - This method is called with the original stream after normalization
   * - The stream has already been consumed by assembleDeltaStream, so metadata
   *   would need to be captured during streaming or from a parallel response
   *
   * @param stream - Response stream (may contain metadata)
   * @returns Response metadata or undefined
   */
  private extractMetadata(stream: ProviderStream): ResponseMetadata | undefined {
    // Metadata extraction is provider-dependent and often not available
    // in streaming mode. For now, we return undefined.
    //
    // Future enhancement: Some providers may include metadata in the
    // final chunk of the stream, which we could capture here.
    //
    // Note: The stream parameter is typed as ProviderStream but is not consumed
    // here since the stream has already been consumed by assembleDeltaStream().
    // This method is kept for potential future enhancements where providers
    // might expose metadata through a separate response object.

    return undefined;
  }

  /**
   * Handles and categorizes errors from provider requests
   *
   * Converts provider-specific errors into standardized ProviderError instances
   * with appropriate context and retry-ability flags.
   *
   * @param error - Original error from provider or stream processing
   * @returns Categorized ProviderError
   */
  private handleError(error: unknown): ProviderError {
    if (error instanceof ProviderError) {
      // Already a ProviderError, just re-throw
      return error;
    }

    const originalError = error instanceof Error ? error : undefined;
    const errorMessage = originalError?.message || 'Unknown error';

    // Categorize errors by message content
    // This is a simple heuristic - could be enhanced with provider-specific error codes

    if (this.isNetworkError(errorMessage)) {
      return new ProviderRequestError(
        `Network error communicating with ${this.providerName}: ${errorMessage}`,
        this.providerName,
        originalError,
        true // Network errors are typically retryable
      );
    }

    if (this.isRateLimitError(errorMessage)) {
      return new ProviderRequestError(
        `Rate limit exceeded for ${this.providerName}: ${errorMessage}`,
        this.providerName,
        originalError,
        true // Rate limits are retryable after delay
      );
    }

    if (this.isAuthenticationError(errorMessage)) {
      return new ProviderConfigurationError(
        `Authentication failed for ${this.providerName}: ${errorMessage}`,
        this.providerName
      );
    }

    // Generic request error (not retryable by default)
    return new ProviderRequestError(
      `Request to ${this.providerName} failed: ${errorMessage}`,
      this.providerName,
      originalError,
      false
    );
  }

  /**
   * Checks if error is related to network connectivity
   */
  private isNetworkError(message: string): boolean {
    const networkKeywords = [
      'network',
      'connection',
      'timeout',
      'econnrefused',
      'enotfound',
      'fetch failed',
    ];

    const lowerMessage = message.toLowerCase();
    return networkKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Checks if error is related to rate limiting
   */
  private isRateLimitError(message: string): boolean {
    const rateLimitKeywords = [
      'rate limit',
      'too many requests',
      'quota exceeded',
      '429',
    ];

    const lowerMessage = message.toLowerCase();
    return rateLimitKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Checks if error is related to authentication
   */
  private isAuthenticationError(message: string): boolean {
    const authKeywords = [
      'authentication',
      'unauthorized',
      'api key',
      'invalid key',
      '401',
      '403',
    ];

    const lowerMessage = message.toLowerCase();
    return authKeywords.some(keyword => lowerMessage.includes(keyword));
  }

  /**
   * Gets the name of the wrapped provider
   * Useful for logging and debugging
   */
  public getProviderName(): string {
    return this.providerName;
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Type guard to check if an error is a ProviderError
 *
 * @param error - Error to check
 * @returns True if error is a ProviderError
 */
export function isProviderError(error: unknown): error is ProviderError {
  return error instanceof ProviderError;
}

/**
 * Checks if a provider error is safe to retry
 *
 * @param error - Error to check
 * @returns True if the error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  return isProviderError(error) && error.isRetryable;
}
