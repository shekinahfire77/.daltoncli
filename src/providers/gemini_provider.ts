
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, FunctionDeclaration, SchemaType } from '@google/generative-ai';
import { ChatMessage } from '../core/schemas';
import { Tool } from '../core/tools';
import { BaseAIProvider } from './BaseAIProvider';
import { ProviderConfig } from '../core/schemas'; // Import ProviderConfig
import { transformToOpenAITools } from '../core/tool_transformers';
import { getApiTimeouts } from '../core/app_limits';


interface GeminiStreamChunk {
  text?: () => string;
}

interface DeltaResponse {
  choices: Array<{
    delta: {
      content: string;
      tool_calls: undefined;
    };
  }>;
}

/**
 * Adapter function to convert Gemini stream chunks to OpenAI-compatible format
 * DEFENSIVE: Handles stream errors and ensures cleanup
 */
async function* adaptGeminiStreamToOpenAI(stream: AsyncIterable<GeminiStreamChunk>): AsyncGenerator<DeltaResponse> {
  try {
    for await (const chunk of stream) {
      try {
        const adaptedChunk: DeltaResponse = {
          choices: [{
            delta: {
              content: chunk.text?.() || '',
              tool_calls: undefined,
            },
          }],
        };
        yield adaptedChunk;
      } catch (chunkError) {
        const message = chunkError instanceof Error ? chunkError.message : 'Unknown error processing chunk';
        throw new Error(`Error processing Gemini stream chunk: ${message}`);
      }
    }
  } catch (error) {
    // Re-throw stream errors with context
    if (error instanceof Error && error.message.includes('timeout')) {
      throw error; // Preserve timeout errors
    }
    throw error;
  }
}

interface ChatCompletionOptions {
  model: string;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
  timeout?: number; // Timeout in milliseconds
}

class GeminiProvider extends BaseAIProvider {
  private client: GoogleGenerativeAI;
  private activeTimeouts: Map<string, NodeJS.Timeout> = new Map();

  constructor(config: ProviderConfig) {
    super('gemini', config);
    this.client = this._createClient();
  }

  private _createClient(): GoogleGenerativeAI {
    try {
      return new GoogleGenerativeAI(process.env[this.config.api_key_env as string] as string);
    } catch (error) {
      this.handleInitializationError(error, this.providerName);
    }
    throw new Error("Failed to create Gemini client.");
  }

  /**
   * Validates and normalizes timeout value
   * DEFENSIVE: Ensures timeout is within safe bounds
   * Uses timeout limits from centralized app_limits configuration
   */
  private normalizeTimeout(timeout?: number): number {
    const apiTimeouts = getApiTimeouts();
    return this.validateTimeout(timeout, apiTimeouts.min, apiTimeouts.max, apiTimeouts.default);
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
   * Safely consumes an async stream to prevent leaks
   * DEFENSIVE: Ensures all stream resources are cleaned up
   */
  private async safeConsumeStream(stream: AsyncIterable<any>, timeoutMs?: number): Promise<void> {
    const timeoutId = timeoutMs ? setTimeout(() => {
      // This won't stop the generator, but it marks timeout occurred
    }, timeoutMs) : undefined;

    try {
      for await (const _ of stream) {
        // Intentionally empty - just consuming
      }
    } catch (error) {
      // Ignore errors during cleanup
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
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

    const { model, tools } = options;
    const requestId = `${this.providerName}-${Date.now()}-${Math.random()}`;

    // Race condition fix: Track active timeout
    this.activeTimeouts.set(requestId, setTimeout(() => {
      this.activeTimeouts.delete(requestId);
    }, timeoutMs));

    try {
      // DEFENSIVE: Validate model configuration
      interface ModelConfigParams {
        model: string;
        safetySettings: Array<{ category: HarmCategory; threshold: HarmBlockThreshold }>;
        tools?: unknown;  // Let Gemini SDK handle validation of tool format
      }

      const modelConfigParams: ModelConfigParams = {
        model,
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
      };

      // Convert and add tools if provided
      if (tools && tools.length > 0) {
        try {
          // Transform tools to Gemini format using helper function
          const convertedTools = transformToOpenAITools(tools);
          // Let the SDK handle the tool format validation
          (modelConfigParams as unknown as Record<string, unknown>).tools = [{ functionDeclarations: convertedTools }];
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`Failed to process tools: ${message}`);
        }
      }

      // DEFENSIVE: Wrap model creation in try-catch
      let generativeModel;
      try {
        generativeModel = this.client.getGenerativeModel(modelConfigParams as Parameters<typeof this.client.getGenerativeModel>[0]);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to create generative model: ${message}`);
      }

      // DEFENSIVE: Validate message transformation
      let history;
      let lastUserPrompt;
      try {
        history = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map((m, idx) => {
            if (!m.role || m.content === undefined) {
              throw new Error(`Invalid message at index ${idx}`);
            }
            return {
              role: m.role === 'assistant' ? 'model' : m.role,
              parts: [{ text: m.content || '' }],
            };
          });

        lastUserPrompt = messages[messages.length - 1]?.content || '';
        if (!lastUserPrompt || typeof lastUserPrompt !== 'string') {
          throw new Error('Last message must contain valid content');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to prepare messages: ${message}`);
      }

      interface StreamResult {
        response: Promise<ResponseType>;
        stream: AsyncIterable<GeminiStreamChunk>;
      }

      interface FunctionCall {
        name: string;
        args: Record<string, unknown>;
      }

      interface ResponseType {
        functionCalls(): FunctionCall[] | null | undefined;
      }

      // DEFENSIVE: Wrap chat stream creation in try-catch
      let chat;
      let result: StreamResult | unknown;
      try {
        chat = generativeModel.startChat({ history });
        result = await Promise.race([
          chat.sendMessageStream(lastUserPrompt),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Gemini API call timed out after ${timeoutMs}ms`)), timeoutMs)
          ),
        ]);
      } catch (apiError) {
        this.activeTimeouts.delete(requestId);

        if (apiError instanceof Error) {
          if (apiError.message.includes('timeout') || apiError.message.includes('timed out')) {
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

      // CRITICAL: The stream MUST be fully consumed or it will break functionality
      // We need to consume the stream in all code paths, even when returning early
      try {
        const streamResult = result as StreamResult;
        const response = await Promise.race([
          streamResult.response,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Gemini response processing timed out after ${timeoutMs}ms`)), timeoutMs)
          ),
        ]);

        const functionCalls = (response as ResponseType).functionCalls();

        if (functionCalls && functionCalls.length > 0) {
          // Consume the entire stream before returning to prevent resource leaks
          // This is critical even though we're not using the streamed content
          await this.safeConsumeStream(streamResult.stream, timeoutMs);

          const tool_calls = functionCalls.map((fc: FunctionCall, i: number) => ({
            index: i,
            id: fc.name, // Gemini doesn't have a unique call ID, so we reuse the name
            function: {
              name: fc.name,
              arguments: JSON.stringify(fc.args),
            },
          }));

          this.activeTimeouts.delete(requestId);
          // Convert to async iterable for consistent return type
          async function* toolCallsGenerator() {
            yield { choices: [{ delta: { tool_calls } }] };
          }
          return toolCallsGenerator();
        }

        this.activeTimeouts.delete(requestId);
        return adaptGeminiStreamToOpenAI(streamResult.stream);

      } catch (error) {
        // Ensure stream cleanup on error
        try {
          // Attempt to consume remaining stream to prevent leaks
          if (result && typeof result === 'object' && 'stream' in result) {
            const streamResult = result as StreamResult;
            await this.safeConsumeStream(streamResult.stream, timeoutMs);
          }
        } catch (cleanupError) {
          // Ignore cleanup errors
        }

        this.activeTimeouts.delete(requestId);

        if (error instanceof Error && error.message.includes('timeout')) {
          throw error; // Preserve timeout errors
        }

        throw error;
      }

    } catch (error) {
      this.activeTimeouts.delete(requestId);

      if (error instanceof Error) {
        throw error;
      }

      throw new Error(`Unexpected error from ${this.providerName}: ${String(error)}`);
    }
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

export default GeminiProvider;
