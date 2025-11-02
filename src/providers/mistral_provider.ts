
import { Mistral } from '@mistralai/mistralai';
import { ChatMessage } from '../core/schemas';
import { Tool } from '../core/tools';
import { getApiTimeouts } from '../core/app_limits';
import { withRetry, ErrorCategory } from '../core/retry_logic';
import { BaseAIProvider } from './BaseAIProvider';
import { ProviderConfig } from '../core/schemas'; // Import ProviderConfig
import { transformToOpenAITools } from '../core/tool_transformers';
import { PROVIDER_NAMES } from '../core/Constants';

interface ChatCompletionOptions {
  model: string;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
  timeout?: number; // Timeout in milliseconds
}

class MistralProvider extends BaseAIProvider {
  private client: Mistral;
  private activeTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();

  constructor(config: ProviderConfig) {
    super('mistral', config);
    this.client = this._createClient();
  }

  private _createClient(): Mistral {
    try {
      // Create Mistral client with API key
      // Note: timeout configuration may be handled differently in Mistral SDK
      return new Mistral({
        apiKey: process.env[this.config.api_key_env as string],
      });
    } catch (error) {
      this.handleInitializationError(error, this.providerName);
    }
    throw new Error("Failed to create Mistral client.");
  }

  /**
   * Validates and normalizes timeout value
   * DEFENSIVE: Ensures timeout is within safe bounds
   * Uses Mistral-specific timeout limits from app_limits config
   */
  private normalizeTimeout(timeout?: number): number {
    const apiTimeouts = getApiTimeouts();
    return this.validateTimeout(timeout, apiTimeouts.min, apiTimeouts.max, apiTimeouts.default);
  }

  /**
   * Creates an AbortController with timeout
   * DEFENSIVE: Ensures proper timeout cleanup and race condition prevention
   */
  private createTimeoutController(timeoutMs: number, requestId: string): { controller: AbortController; cleanup: () => void } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    }, timeoutMs);

    // Race condition fix: Track abort controllers
    this.abortControllers.set(requestId, controller);

    return {
      controller,
      cleanup: () => {
        clearTimeout(timeoutId);
        this.abortControllers.delete(requestId);
      },
    };
  }

  /**
   * Validates message parameters before sending
   * DEFENSIVE: Input validation before API call
   */
  private validateMessages(messages: ChatMessage[]): void {
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

      if (typeof msg.role !== 'string' || !msg.role.trim()) {
        throw new Error(`Message at index ${i} has invalid role`);
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

  /**
   * Wraps an async generator with timeout protection
   * DEFENSIVE: Ensures streaming operations don't hang indefinitely
   */
  private async *withTimeout<T>(
    generator: AsyncGenerator<T>,
    timeoutMs: number,
    requestId: string
  ): AsyncGenerator<T> {
    const timeoutId = setTimeout(() => {
      const controller = this.abortControllers.get(requestId);
      if (controller && !controller.signal.aborted) {
        controller.abort();
      }
    }, timeoutMs);

    try {
      for await (const item of generator) {
        // Check if request has been aborted
        const controller = this.abortControllers.get(requestId);
        if (controller?.signal.aborted) {
          throw new Error(`Mistral streaming operation timed out after ${timeoutMs}ms`);
        }
        yield item;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  public async getChatCompletion(messages: ChatMessage[], options: ChatCompletionOptions): Promise<AsyncIterable<unknown>> {
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

    // Generate unique request ID for tracking
    const requestId = `${this.providerName}-${Date.now()}-${Math.random()}`;

    // Race condition fix: Track active timeout
    this.activeTimeouts.set(requestId, setTimeout(() => {
      this.activeTimeouts.delete(requestId);
      const controller = this.abortControllers.get(requestId);
      if (controller && !controller.signal.aborted) {
        controller.abort();
      }
    }, timeoutMs));

    const { controller, cleanup } = this.createTimeoutController(timeoutMs, requestId);

    try {
      // DEFENSIVE: Validate message transformation
      interface MistralMessage {
        role: string;
        content: string;
        tool_calls?: ChatMessage['tool_calls'];
      }

      let transformedMessages: MistralMessage[];
      try {
        transformedMessages = messages.map((msg, idx): MistralMessage => {
          if (!msg.role || msg.content === undefined) {
            throw new Error(`Invalid message structure at index ${idx}`);
          }
          return {
            role: msg.role,
            content: msg.content || '',
            ...(msg.tool_calls && { tool_calls: msg.tool_calls }),
          };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error transforming messages';
        throw new Error(`Failed to transform messages for Mistral: ${message}`);
      }

      // DEFENSIVE: Wrap API call in try-catch
      let result;
      try {
        // Transform tools to Mistral format using helper function
        const transformedTools = transformToOpenAITools(tools);

        // Mistral SDK expects tools and toolChoice in its own format
        result = this.client.chat.stream({
          model,
          messages: transformedMessages as unknown as Parameters<typeof this.client.chat.stream>[0]['messages'],
          ...(transformedTools.length > 0 && { tools: transformedTools as unknown as Parameters<typeof this.client.chat.stream>[0]['tools'] }),
          ...(tool_choice && { toolChoice: tool_choice as unknown as Parameters<typeof this.client.chat.stream>[0]['toolChoice'] }),
        });
      } catch (apiError) {
        cleanup();
        this.activeTimeouts.delete(requestId);

        if (apiError instanceof Error) {
          if (apiError.message.includes('timeout') || apiError.message.includes('aborted')) {
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

      // DEFENSIVE: Validate result before returning
      if (!result) {
        throw new Error(`No result returned from ${this.providerName} API`);
      }

      cleanup();
      this.activeTimeouts.delete(requestId);

      // Return the stream (EventStream from Mistral SDK is already async iterable)
      return result as unknown as AsyncIterable<unknown>;

    } catch (error) {
      cleanup();
      this.activeTimeouts.delete(requestId);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(`Unexpected error from ${this.providerName}: ${String(error)}`);
    }
  }

  /**
   * Cleans up any pending timeouts and controllers
   * DEFENSIVE: Prevents timeout and memory leaks
   * Should be called when provider is destroyed
   */
  public cleanup(): void {
    // Clear all pending timeouts
    for (const timeoutId of this.activeTimeouts.values()) {
      clearTimeout(timeoutId);
    }
    this.activeTimeouts.clear();

    // Abort all pending requests
    for (const controller of this.abortControllers.values()) {
      if (!controller.signal.aborted) {
        controller.abort();
      }
    }
    this.abortControllers.clear();
  }

  /**
   * Destructor-like cleanup
   * Note: JavaScript doesn't have true destructors, so this must be called explicitly
   */
  public destroy(): void {
    this.cleanup();
  }
}

export default MistralProvider;
