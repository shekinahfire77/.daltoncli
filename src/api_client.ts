import { aiProviders } from './config';
import { getOpenAIProvider } from './providers/openai';
import { getMistralProvider } from './providers/mistral';

/**
 * Interface representing an AI provider
 */
interface AIProvider {
  name: string;
  client: any; // TODO: Replace with actual client type from provider implementations
}

/**
 * Retrieves an AI provider instance by name
 * @param providerName - The name of the provider ('openai', 'mistralai')
 * @returns The AIProvider instance or undefined if provider not found
 */
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
