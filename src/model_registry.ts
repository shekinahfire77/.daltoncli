import { z } from 'zod';
import { ModelRegistrySchema, ModelRegistry, ModelSchema } from './core/schemas';
import { aiProviders } from './config';
import { fetchOpenRouterModels } from './utils/openrouter_utils';

export const modelRegistry: Promise<ModelRegistry> = (async () => {
  const registry: ModelRegistry = {};

  // Add models from statically configured providers
  for (const providerName in aiProviders) {
    if (aiProviders.hasOwnProperty(providerName)) {
      const providerConfig = aiProviders[providerName];
      if (providerConfig.enabled) {
        for (const model of providerConfig.models) {
          registry[model.id] = { ...model, provider: providerName };
        }
      }
    }
  }

  // Dynamically fetch and add OpenRouter models if enabled
  if (aiProviders.openrouter && aiProviders.openrouter.enabled) {
    const openRouterModels = await fetchOpenRouterModels();
    for (const model of openRouterModels) {
      registry[model.id] = { ...model, provider: 'openrouter' };
      // Also add the dynamically fetched models to the openrouter provider's config
      // This ensures they are available through the config object as well
      aiProviders.openrouter.models.push(model);
    }
  }

  return ModelRegistrySchema.parse(registry);
})();
