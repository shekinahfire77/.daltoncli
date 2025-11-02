import { z } from 'zod';

/**
 * Schema for provider-grouped model registry
 * This is a different structure from the main ModelRegistry
 * Groups models by provider name
 */
const ProviderGroupedRegistrySchema = z.record(
  z.string(), // Provider key (e.g., 'openai', 'mistral')
  z.object({
    name: z.string(), // Display name (e.g., 'OpenAI', 'Mistral')
    models: z.array(z.string()), // Array of model IDs
  })
);

/**
 * Type definition for the provider-grouped model registry
 */
export type ProviderGroupedRegistry = z.infer<typeof ProviderGroupedRegistrySchema>;

/**
 * Global registry of available AI models grouped by provider
 * Contains model listings for all supported AI providers
 */
export const modelRegistry: ProviderGroupedRegistry = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo', 'gpt-5-nano'],
  },
  azure: {
    name: 'Azure',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-35-turbo', 'gpt-4o', 'gpt-5-nano', 'gpt-4-deployment', 'gpt-35-turbo-deployment', 'gpt-4o-deployment'],
  },
  groq: {
    name: 'Groq',
    models: ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768'],
  },
  mistral: {
    name: 'Mistral',
    models: ['mistral-large-latest', 'mistral-small-latest'],
  },
  gemini: {
    name: 'Gemini',
    models: ['gemini-1.5-pro-latest', 'gemini-1.0-pro'],
  },
  openaicompatible: {
    name: 'OpenAI-Compatible',
    models: ['deepseek-coder', 'Qwen/Qwen1.5-72B-Chat', 'microsoft/phi-2'],
  },
};

ProviderGroupedRegistrySchema.parse(modelRegistry);

/**
 * Represents a model available for selection
 */
interface AvailableModel {
  name: string;
  value: { provider: string; model: string };
}

/**
 * Retrieves available models for the specified providers
 * @param configuredProviders - Array of provider names to retrieve models for
 * @returns Array of available models formatted for selection
 */
export const getAvailableModels = (configuredProviders: string[]): AvailableModel[] => {
  const available: AvailableModel[] = [];
  for (const provider of configuredProviders) {
    if (modelRegistry[provider]) {
      const providerInfo = modelRegistry[provider];
      providerInfo.models.forEach((model: string) => {
        available.push({
          name: `${providerInfo.name}: ${model}`,
          value: { provider, model }
        });
      });
    }
  }
  return available;
};
