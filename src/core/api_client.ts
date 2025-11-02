
import OpenAIProvider from '../providers/openai_provider';
import MistralProvider from '../providers/mistral_provider';
import GeminiProvider from '../providers/gemini_provider';
import OpenRouterProvider from '../providers/openrouter_provider'; // New import

import { aiProviders } from '../config'; // Import aiProviders
import { ProviderConfig } from './schemas'; // Import ProviderConfig
import { ProviderWrapper } from './provider_wrapper';
import { ChatMessage } from './schemas';
import { Tool } from './tools';

interface ChatCompletionOptions {
  model: string;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
}

// Error handling and type validation
// Use a more flexible interface that matches both ChatMessage and OpenAI's message types
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ChatCompletionResult {
  stream: AsyncIterable<unknown>;
  tokenUsage: TokenUsage;
}

export interface AIProvider {
  providerName: string;
  getChatCompletion(messages: unknown[], options: ChatCompletionOptions): Promise<any>;
}

/**
 * Gets a raw provider instance
 *
 * This is the legacy API for direct provider access.
 * For new code, consider using getProviderWrapper() instead
 * for a more consistent interface.
 *
 * @param providerName - Name of the provider (e.g., 'openai', 'mistral', 'gemini')
 * @returns Provider instance
 * @throws {Error} If provider is unknown or unsupported
 */
export const getProvider = (providerName: string): AIProvider => {
  // DEFENSIVE: Validate provider name parameter
  if (typeof providerName !== 'string' || !providerName.trim()) {
    throw new Error('Provider name must be a non-empty string');
  }

  const providerConfig = aiProviders[providerName];

  if (!providerConfig || !providerConfig.enabled) {
    throw new Error(`Provider '${providerName}' is not configured or not enabled.`);
  }

  switch (providerName) {
    case 'openai':
    case 'azure':
    case 'groq':
      try {
        return new OpenAIProvider(providerName, providerConfig);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to initialize ${providerName} provider: ${message}`);
      }
    case 'mistral':
      try {
        return new MistralProvider(providerConfig);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to initialize mistral provider: ${message}`);
      }
    case 'google':
      try {
        return new GeminiProvider(providerConfig);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to initialize gemini provider: ${message}`);
      }
    case 'openrouter':
      try {
        return new OpenRouterProvider(providerConfig);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to initialize openrouter provider: ${message}`);
      }

    default:
      throw new Error(`Unknown or unsupported provider: ${providerName}`);
  }
};

/**
 * Gets a unified provider wrapper instance
 *
 * This is the recommended API for interacting with AI providers.
 * It provides a consistent interface across all providers and handles
 * provider-specific quirks internally.
 *
 * Benefits over getProvider():
 * - Unified sendChat() API across all providers
 * - Normalized streaming responses
 * - Consistent error handling
 * - Built-in support for real-time content callbacks
 * - Simpler tool call handling
 * - Timeout protection for all API calls
 *
 * @param providerName - Name of the provider (e.g., 'openai', 'mistral', 'gemini')
 * @returns ProviderWrapper instance
 * @throws {ProviderConfigurationError} If provider is not configured or unavailable
 *
 * @example
 * ```typescript
 * const wrapper = getProviderWrapper('openai');
 * const response = await wrapper.sendChat(messages, {
 *   model: 'gpt-4',
 *   tools: myTools,
 *   onContent: (chunk) => console.log(chunk),
 *   timeout: 30000  // 30 second timeout
 * });
 * ```
 */
export const getProviderWrapper = (providerName: string): ProviderWrapper => {
  // DEFENSIVE: Validate provider name before creating wrapper
  if (typeof providerName !== 'string' || !providerName.trim()) {
    throw new Error('Provider name must be a non-empty string');
  }

  try {
    return new ProviderWrapper(providerName);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to create provider wrapper for '${providerName}': ${message}`);
  }
};
