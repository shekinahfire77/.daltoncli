import { z } from 'zod';
import { ModelSchema } from '../core/schemas';

const OpenRouterApiModelsSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    name: z.string(),
    context_length: z.number().optional(),
    pricing: z.object({
      prompt: z.string().optional(),
      completion: z.string().optional(),
    }).optional(),
    // Other fields exist but are not strictly needed for our ModelSchema
  })),
});

export async function fetchOpenRouterModels(): Promise<z.infer<typeof ModelSchema>[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    console.warn("OPENROUTER_API_KEY not set. Cannot fetch models from OpenRouter API.");
    return [];
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch OpenRouter models: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const validatedData = OpenRouterApiModelsSchema.parse(data);

    return validatedData.data.map((model) => {
      const promptCost = model.pricing?.prompt ? parseFloat(model.pricing.prompt) : NaN;
      const completionCost = model.pricing?.completion ? parseFloat(model.pricing.completion) : NaN;

      const cost_per_1k_input = isNaN(promptCost) || promptCost < 0 ? 0 : promptCost / 1000; // Convert per million to per 1k
      const cost_per_1k_output = isNaN(completionCost) || completionCost < 0 ? 0 : completionCost / 1000;

      return {
        id: model.id,
        name: model.name,
        capabilities: ['text'], // OpenRouter API doesn't expose capabilities directly in this list, default to text
        max_tokens: model.context_length || 32768, // Default if not provided
        cost_per_1k_input: cost_per_1k_input,
        cost_per_1k_output: cost_per_1k_output,
        provider: 'openrouter', // Add the provider here
      };
    });
  } catch (error) {
    console.error("Error fetching OpenRouter models:", error);
    return [];
  }
}