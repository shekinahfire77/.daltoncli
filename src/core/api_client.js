const OpenAIProvider = require('../providers/openai_provider');
const MistralProvider = require('../providers/mistral_provider');
const GeminiProvider = require('../providers/gemini_provider');
const { readConfig } = require('./config');

const getProvider = (providerName) => {
  const config = readConfig();
  const providerConfig = config.ai_providers?.[providerName];

  // This logic determines if a provider should use the OpenAIProvider because it's an OpenAI-compatible endpoint.
  const isOpenAICompatible = providerConfig?.api_endpoint;

  if (isOpenAICompatible) {
    return new OpenAIProvider(providerName);
  }

  // Standard provider selection
  switch (providerName) {
    case 'openai':
    case 'azure': // Azure is also handled by OpenAIProvider
    case 'groq': // Groq is also handled by OpenAIProvider
      return new OpenAIProvider(providerName);
    case 'mistral':
      return new MistralProvider();
    case 'gemini':
      return new GeminiProvider();
    default:
      throw new Error(`Unknown or unsupported provider: ${providerName}`);
  }
};

module.exports = { getProvider };