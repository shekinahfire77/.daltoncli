import OpenAI from 'openai';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { Tool } from '../core/tools';
import { getApiTimeouts } from '../core/app_limits';
import { withRetry, categorizeError, ErrorCategory } from '../core/retry_logic';
import { BaseAIProvider } from './BaseAIProvider';
import { ProviderConfig } from '../core/schemas';
import { transformToOpenAITools } from '../core/tool_transformers';
import { countTokens } from '../utils/token_counter'; // Import token counter

interface ChatCompletionOptions {
  model: string;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
  timeout?: number; // Timeout in milliseconds
}

class OpenRouterProvider extends BaseAIProvider {
  private client: OpenAI;
  private activeTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: ProviderConfig) {
    super('openrouter', config);
    this.client = this._createClient();
  }

  private _createClient(): OpenAI {
    try {
      const apiTimeouts = getApiTimeouts();
      return new OpenAI({
        apiKey: process.env[this.config.api_key_env as string],
        baseURL: this.config.base_url,
        timeout: apiTimeouts.default,
      });
    } catch (error) {
      this.handleInitializationError(error, this.providerName);
    }
    throw new Error("Failed to create OpenRouter client.");
  }

  /**
   * Validates and normalizes timeout value
   * DEFENSIVE: Ensures timeout is within safe bounds
   * Uses OpenAI-specific timeout limits from app_limits config
   */
  private normalizeTimeout(timeout?: number): number {
    const apiTimeouts = getApiTimeouts();
    return this.validateTimeout(timeout, apiTimeouts.min, apiTimeouts.max, apiTimeouts.default);
  }

  /**
   * Creates an AbortSignal with timeout
   * DEFENSIVE: Ensures proper timeout cleanup
   */
  private createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; cleanup: () => void } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    return {
      signal: controller.signal,
      cleanup: () => clearTimeout(timeoutId),
    };
  }

  /**
   * Validates message parameters before sending
   * DEFENSIVE: Input validation before API call
   */
  private validateMessages(messages: ChatCompletionMessageParam[]): void {
    if (!Array.isArray(messages)) {
      throw new Error('Messages must be an array');
    }

    if (messages.length === 0) {
      throw new Error('Messages array cannot be empty');
    }

    // Validate each message has required structure
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      if (!msg || typeof msg !== 'object') {
        throw new Error(`Message at index ${i} is invalid`);
      }

      // All messages must have a role
      if (!('role' in msg)) {
        throw new Error(`Message at index ${i} is missing required field: role`);
      }

      // Validate based on message role type
      const role = (msg as any).role;

      if (role === 'tool') {
        // Tool messages must have: role, tool_call_id, name, and content
        if (!('tool_call_id' in msg) || !('name' in msg) || !('content' in msg)) {
          throw new Error(`Tool message at index ${i} is missing required fields (tool_call_id, name, content)`);
        }
      } else if (role === 'assistant' && 'tool_calls' in msg) {
        // Assistant messages with tool_calls don't require content
        // They must have role and tool_calls array
        if (!Array.isArray((msg as any).tool_calls)) {
          throw new Error(`Assistant message at index ${i} has invalid tool_calls (must be an array)`);
        }
      } else {
        // All other messages (system, user, assistant without tool_calls) must have content
        if (!('content' in msg)) {
          throw new Error(`Message at index ${i} is missing required field: content`);
        }
      }
    }
  }

  /**
   * Validates options parameters before sending
   * DEFENSIVE: Input validation before API call
   */
  private validateOptions(options: ChatCompletionOptions): void {
    if (!options || typeof options !== 'object') {
      throw new Error('Options must be a valid object');
    }

    if (typeof options.model !== 'string' || !options.model.trim()) {
      throw new Error('Model must be specified as a non-empty string');
    }

    // Validate tools if provided
    if (options.tools !== undefined && !Array.isArray(options.tools)) {
      throw new Error('Tools must be an array if provided');
    }

    // Validate tool_choice if provided
    if (options.tool_choice !== undefined) {
      const validChoices = ['none', 'auto'];
      const isValidChoice = validChoices.includes(options.tool_choice as string) ||
        (typeof options.tool_choice === 'object' && options.tool_choice !== null);

      if (!isValidChoice) {
        throw new Error('Invalid tool_choice value');
      }
    }
  }

  public async getChatCompletion(messages: ChatCompletionMessageParam[], options: ChatCompletionOptions): Promise<{ stream: AsyncIterable<unknown>; tokenUsage: { inputTokens: number; outputTokens: number; } }> {
    // DEFENSIVE: Input validation
    try {
      this.validateMessages(messages);
      this.validateOptions(options);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown validation error';
      throw new Error(`Invalid input for ${this.providerName}: ${message}`);
    }

    // DEFENSIVE: Normalize and validate timeout
    let timeoutMs: number;
    try {
      timeoutMs = this.normalizeTimeout(options.timeout);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown timeout error';
      throw new Error(`Timeout configuration error: ${message}`);
    }

    const { model, tools, tool_choice } = options;

    // Calculate input tokens
    let inputTokens = 0;
    for (const message of messages) {
      if (message.content) {
        inputTokens += countTokens(message.content as string, model);
      }
      // TODO: Handle tool_calls token counting if necessary
    }
    console.log(`[${this.providerName}] Input tokens: ${inputTokens}`);

    // DEFENSIVE: Wrap API call with exponential backoff retry logic
    return await withRetry(
      async () => {
        // DEFENSIVE: Create timeout signal and ensure cleanup
        const { signal, cleanup } = this.createTimeoutSignal(timeoutMs);

        try {
          const requestId = `${this.providerName}-${Date.now()}-${Math.random()}`;
          this.activeTimeouts.set(requestId, setTimeout(() => {
            // Race condition fix: Mark request as timed out
            this.activeTimeouts.delete(requestId);
          }, timeoutMs));

          // DEFENSIVE: Wrap API call in try-catch for network errors
          let result;
          let fullResponseContent = ''; // To accumulate streamed content for token counting
          try {
            interface RequestOptions {
              signal: AbortSignal;
              timeout: number;
            }

            // Transform tools to OpenAI format using helper function
            const transformedTools = transformToOpenAITools(tools);

            const stream = await this.client.chat.completions.create(
              {
                messages,
                model: model,
                ...(transformedTools.length > 0 && { tools: transformedTools }),
                ...(tool_choice && { tool_choice }),
                stream: true,
              },
              {
                signal, // Pass abort signal for timeout
                timeout: timeoutMs,
              } as RequestOptions
            );

            // Wrap the stream to count output tokens
            const wrappedStream = (async function* () {
              for await (const chunk of stream) {
                const content = chunk.choices[0]?.delta?.content || '';
                fullResponseContent += content;
                yield chunk;
              }
            })();

            result = wrappedStream;

          } catch (apiError) {
            // Cleanup timeout on error
            cleanup();

            // Handle specific error types
            if (apiError instanceof Error) {
              if (apiError.name === 'AbortError' || apiError.message.includes('timeout') || apiError.message.includes('aborted')) {
                throw new Error(`API request timed out after ${timeoutMs}ms for ${this.providerName}`);
              }
              if (apiError.message.includes('401') || apiError.message.includes('Unauthorized')) {
                throw new Error(`Authentication failed for ${this.providerName}: ${apiError.message}`);
              }
              if (apiError.message.includes('429') || apiError.message.includes('rate limit')) {
                throw new Error(`Rate limit exceeded for ${this.providerName}: ${apiError.message}`);
              }
            }

            throw apiError;
          }

          // Cleanup successful timeout
          cleanup();

          // DEFENSIVE: Validate result before returning
          if (!result) {
            throw new Error(`No result returned from ${this.providerName} API`);
          }

          this.activeTimeouts.delete(requestId);

          // Log output tokens after the stream has been fully consumed
          // This will happen when the wrappedStream iterator is exhausted
          const self = this; // Capture 'this'
          let finalOutputTokens = 0;
          const finalResultStream = (async function* () {
            for await (const chunk of result) { // Use result here
              yield chunk;
            }
            finalOutputTokens = countTokens(fullResponseContent, model);
            console.log(`[${self.providerName}] Output tokens: ${finalOutputTokens}`);
          })();

          return { stream: finalResultStream, tokenUsage: { inputTokens, outputTokens: finalOutputTokens } };

        } catch (error) {
          // Ensure cleanup in all error paths
          cleanup();

          // Re-throw with context
          if (error instanceof Error) {
            throw error;
          }

          throw new Error(`Unexpected error from ${this.providerName}: ${String(error)}`);
        }
      },
      {
        // Custom retry logic - don't retry authentication errors
        shouldRetry: (error: Error, category: ErrorCategory) => {
          // Never retry authentication errors or client errors
          if (category === ErrorCategory.AUTHENTICATION || category === ErrorCategory.CLIENT_ERROR) {
            return false;
          }

          // Retry network errors, rate limits, and server errors
          return (
            category === ErrorCategory.NETWORK ||
            category === ErrorCategory.RATE_LIMIT ||
            category === ErrorCategory.SERVER_ERROR
          );
        },
        onRetry: (attempt, delay, error) => {
          console.warn(
            `[${this.providerName}] Retry attempt ${attempt} after ${delay}ms due to: ${error.message}`
          );
        },
      }
    );
  }

  /**
   * Cleans up any pending timeouts
   * DEFENSIVE: Prevents timeout leaks
   * Should be called when provider is destroyed
   */
  public cleanup(): void {
    for (const timeoutId of this.activeTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.activeTimeouts.clear();
  }

  /**
   * Destructor-like cleanup
   * Note: JavaScript doesn't have true destructors, so this must be called explicitly
   */
  public destroy(): void {
    this.cleanup();
  }
}

export default OpenRouterProvider;
