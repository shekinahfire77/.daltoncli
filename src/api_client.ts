import { config } from './config';
import { getOpenAIProvider } from './providers/openai';
import { getMistralProvider } from './providers/mistral';

interface AIProvider {
  name: string;
  client: any; // Replace with actual client type
}

export function getProvider(providerName: string): AIProvider | undefined {
  switch (providerName) {
    case 'openai':
      return getOpenAIProvider();
    case 'mistralai':
      return getMistralProvider();
    default:
      console.warn(`Unknown provider: ${providerName}`);
      return undefined;
  }
}

// Example of how to use it
const defaultProvider = getProvider(config.name);
if (defaultProvider) {
  console.log(`Using AI provider: ${defaultProvider.name}`);
}
