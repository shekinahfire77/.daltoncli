const modelRegistry = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  groq: {
    name: 'Groq',
    models: ['llama3-8b-8192', 'llama3-70b-8192', 'mixtral-8x7b-32768'],
  },
  // Add other providers here in the future
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
