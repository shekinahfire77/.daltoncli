const modelRegistry = {
  // Standard OpenAI
  openai: {
    name: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  // Azure OpenAI
  azure: {
    name: 'Azure',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  // Groq (OpenAI-compatible)
  groq: {
    name: 'Groq',
    models: ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768'],
  },
  // Official Mistral API
  mistral: {
    name: 'Mistral',
    models: ['mistral-large-latest', 'mistral-small-latest'],
  },
  // Official Google Gemini API
  gemini: {
    name: 'Gemini',
    models: ['gemini-1.5-pro-latest', 'gemini-1.0-pro'],
  },
  // Generic provider for other OpenAI-compatible APIs (e.g., Together, Anyscale, local models)
  openaicompatible: {
    name: 'OpenAI-Compatible',
    models: ['deepseek-coder', 'Qwen/Qwen1.5-72B-Chat', 'microsoft/phi-2'], // Example models
  },
};

const getAvailableModels = (configuredProviders) => {
  const available = [];
  for (const provider of configuredProviders) {
    if (modelRegistry[provider]) {
      const providerInfo = modelRegistry[provider];
      providerInfo.models.forEach(model => {
        available.push({ 
          name: `${providerInfo.name}: ${model}`,
          value: { provider, model } 
        });
      });
    }
  }
  return available;
};

module.exports = { getAvailableModels };