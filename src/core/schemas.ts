import { z } from 'zod';

export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.any()), // Loosely typed for now, can be refined
  func: z.function(), // Represents the function to be called
  isNetworkTool: z.boolean().optional(),
});

export const ProviderConfigSchema = z.object({
  name: z.string(),
  apiKey: z.string(),
  defaultModel: z.string(),
  elevatedModel: z.string().optional(),
  defaultChatModel: z.string().optional(),
  // Add other provider-specific configurations as needed
}).strict();

export const ModelRegistrySchema = z.record(
  z.string(), // Model name
  z.object({
    provider: z.string(),
    modelId: z.string(),
    // Add other model-specific configurations as needed
  })
);

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().optional(),
  tool_calls: z.array(z.object({
    id: z.string(),
    function: z.object({
      name: z.string(),
      arguments: z.string(),
    }),
  })).optional(),
  tool_call_id: z.string().optional(),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type ModelRegistry = z.infer<typeof ModelRegistrySchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;