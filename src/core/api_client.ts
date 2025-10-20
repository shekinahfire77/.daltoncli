
import OpenAIProvider from '../providers/openai_provider';
import MistralProvider from '../providers/mistral_provider';
import GeminiProvider from '../providers/gemini_provider';
import { readConfig } from './config';

interface AIProvider {
  getChatCompletion(messages: any[], options: any): Promise<any>;
}

export const getProvider = (providerName: string): AIProvider => {
  const config = readConfig();
  const providerConfig = config.ai_providers?.[providerName];

  const isOpenAICompatible = providerConfig?.api_endpoint;

  if (isOpenAICompatible) {
    return new OpenAIProvider(providerName);
  }

  switch (providerName) {
    case 'openai':
    case 'azure':
    case 'groq':
      return new OpenAIProvider(providerName);
    case 'mistral':
      return new MistralProvider();
    case 'gemini':
      return new GeminiProvider();
    default:
      throw new Error(`Unknown or unsupported provider: ${providerName}`);
  }
};
