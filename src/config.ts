import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { ProviderConfigSchema, ProviderConfig, ModelSchema, RetryConfigSchema } from './core/schemas';

interface AiProvidersConfig {
  [key: string]: ProviderConfig;
}

const configPath = path.join(__dirname, '..', 'config.json');

let aiProviders: AiProvidersConfig = {};

try {
  const configFileContent = fs.readFileSync(configPath, 'utf-8');
  const fullConfig = JSON.parse(configFileContent);

  if (fullConfig.ai_providers) {
    for (const providerName in fullConfig.ai_providers) {
      if (fullConfig.ai_providers.hasOwnProperty(providerName)) {
        const rawProviderConfig = fullConfig.ai_providers[providerName];
        // Exclude _comment fields from validation
        if (providerName.startsWith('_')) {
          continue; // Skip _comment fields
        }

        // Deep copy to avoid modifying the original raw config
        const providerConfigToValidate = JSON.parse(JSON.stringify(rawProviderConfig));

        // Inject provider name into each model before validation
        if (providerConfigToValidate.models && Array.isArray(providerConfigToValidate.models)) {
          providerConfigToValidate.models = providerConfigToValidate.models.map((model: any) => ({
            ...model,
            provider: providerName,
          }));
        }

        try {
          // Remove _comment field if it exists in the copied object before parsing
          delete providerConfigToValidate._comment;
          const validatedProviderConfig = ProviderConfigSchema.parse(providerConfigToValidate);
          // Cast to the full ProviderConfig type (schema allows a simplified test shape too)
          aiProviders[providerName] = validatedProviderConfig as ProviderConfig;
        } catch (error) {
          if (error instanceof z.ZodError) {
            console.error(`Configuration validation error for provider '${providerName}':`);
            error.errors.forEach(err => {
              console.error(`- ${err.path.join('.')}: ${err.message}`);
            });
          } else {
            console.error(`An unexpected error occurred during configuration validation for provider '${providerName}':`, error);
          }
          process.exit(1);
        }
      }
    }
  }
} catch (error) {
  console.error("Error loading or parsing config.json:", error);
  process.exit(1);
}

export { aiProviders };

// Build a lightweight runtime config object used by callers/tests
// Choose the primary provider (prefer 'openai' if present) or the first provider found.
const primaryProviderName = Object.keys(aiProviders).includes('openai')
  ? 'openai'
  : Object.keys(aiProviders)[0] || '';

export const config = {
  name: primaryProviderName,
  apiKey: getApiKey(primaryProviderName),
  defaultModel: aiProviders[primaryProviderName]?.default_model || '',
  elevatedModel: aiProviders[primaryProviderName]?.default_model || '',
  defaultChatModel: aiProviders[primaryProviderName]?.default_model || '',
};

/**
 * Retrieves the API key for a specific provider
 * @param providerName - The name of the provider to retrieve the key for
 * @returns The API key if the provider matches the configured provider, empty string otherwise
 */
export function getApiKey(providerName: string): string {
  const providerConfig = aiProviders[providerName];
  if (providerConfig && providerConfig.api_key_env) {
    return process.env[providerConfig.api_key_env] || '';
  }
  return '';
}

