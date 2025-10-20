import { z } from 'zod';
import { ModelRegistrySchema, ModelRegistry } from './core/schemas';

// Example model registry (replace with actual models)
const modelRegistryData = {
  'gpt-4o': {
    provider: 'openai',
    modelId: 'gpt-4o',
  },
  'mistral-large': {
    provider: 'mistralai',
    modelId: 'mistral-large',
  },
};

export const modelRegistry: ModelRegistry = ModelRegistrySchema.parse(modelRegistryData);
