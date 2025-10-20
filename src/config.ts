import { z } from 'zod';
import { ProviderConfigSchema, ProviderConfig } from './core/schemas';

// Example provider configuration (replace with actual configurations)
const rawProviderConfig = {
  name: 'openai',
  apiKey: process.env.OPENAI_API_KEY || '',
  defaultModel: 'gpt-4o',
  elevatedModel: 'gpt-4o', // Default elevated model
  defaultChatModel: 'gpt-3.5-turbo', // Default cheap fast model
  // Add other provider-specific configurations as needed
};

let validatedConfig: ProviderConfig;

try {
  validatedConfig = ProviderConfigSchema.parse(rawProviderConfig);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("Configuration validation error:");
    error.errors.forEach(err => {
      console.error(`- ${err.path.join('.')}: ${err.message}`);
    });
    console.error("Please check your configuration for unknown keys or incorrect types.");
  } else {
    console.error("An unexpected error occurred during configuration validation:", error);
  }
  // Exit or use a default safe configuration
  process.exit(1); 
}

export const config: ProviderConfig = validatedConfig;

// Example of a function that might be in config.js, now typed
export function getApiKey(providerName: string): string {
  if (config.name === providerName) {
    return config.apiKey;
  }
  return '';
}
