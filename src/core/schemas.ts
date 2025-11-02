import { z } from 'zod';

// Legacy schema (deprecated, kept for backwards compatibility)
export const ToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  parameters: z.record(z.any()), // Loosely typed for now, can be refined
  func: z.function(), // Represents the function to be called
  isNetworkTool: z.boolean().optional(),
});

export const RetryConfigSchema = z.object({
  max_retries: z.number().int().min(0),
  initial_delay_ms: z.number().int().min(0),
  backoff_multiplier: z.number().min(1),
  max_delay_ms: z.number().int().min(0),
});

export const ModelSchema = z.object({
  id: z.string(),
  modelId: z.string().optional(),
  name: z.string(),
  capabilities: z.array(z.string()),
  max_tokens: z.number().int().min(1),
  cost_per_1k_input: z.number().min(0).optional(),
  cost_per_1k_output: z.number().min(0).optional(),
  // provider will be injected by runtime (where needed); make optional for raw config validation
  provider: z.string().optional(),
});

const ProviderConfigFullSchema = z.object({
  enabled: z.boolean(),
  api_key_env: z.string(),
  base_url: z.string().url().optional(), // Made optional for providers like Azure
  default_model: z.string(),
  timeout_seconds: z.number().int().min(1),
  models: z.array(ModelSchema),
  retry_config: RetryConfigSchema,
  // Azure-specific fields
  deployment_name: z.string().optional(),
  resource_name: z.string().optional(),
  api_version: z.string().optional(),
  endpoint_env: z.string().optional(),
  _comment: z.string().optional(), // Allow _comment field at provider level
});

// Simple provider schema used in some tests and lightweight config objects
const SimpleProviderConfigSchema = z.object({
  name: z.string(),
  apiKey: z.string(),
  defaultModel: z.string(),
  elevatedModel: z.string(),
  defaultChatModel: z.string(),
}).strict();

// Exported provider schema accepts either the full provider config or the simple test-friendly shape
export const ProviderConfigSchema = z.union([ProviderConfigFullSchema, SimpleProviderConfigSchema]);

export const ModelRegistrySchema = z.record(
  z.string(), // Model ID
  ModelSchema
);

// AI providers map: allows an optional top-level _comment and any provider keys
export const aiProvidersMapSchema = z.object({
  _comment: z.string().optional(),
}).catchall(ProviderConfigFullSchema);

// Keep a backwards-compatible export name
export const aiConfigSchema = z.object({
  _comment: z.string().optional(),
}).catchall(ProviderConfigSchema);

// Top-level application config schema
// NOTE: declared after MCP schema to avoid temporal-use-before-declare

// MCP Integration Server Schema
const mcpServerSchema = z.object({
  _comment: z.string().optional(),
  name: z.string(),
  enabled: z.boolean(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  timeout_seconds: z.number().int().min(1).optional(),
  environment: z.record(z.string(), z.string()).optional(),
});

// MCP Integrations Schema
export const McpIntegrationsSchema = z.object({
  _comment: z.string().optional(),
  enabled: z.boolean(),
  servers: z.array(mcpServerSchema).optional(),
  auto_discovery: z.boolean().optional(),
  discovery_paths: z.array(z.string()).optional(),
});

// Now declare the top-level application config schema (after MCP schema)
export const configSchema = z.object({
  _description: z.string().optional(),
  _version: z.string().optional(),
  _documentation: z.string().optional(),
  ai_providers: aiProvidersMapSchema.optional(),
  mcp_integrations: McpIntegrationsSchema.optional(),
  runtime_settings: z.record(z.string(), z.any()).optional(),
  fallback_strategy: z.record(z.string(), z.any()).optional(),
});

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

// OpenAI-style tool definition schema (for chat completions)
// This is the schema used in tools.ts
const openAIToolSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
    description: z.string(),
    parameters: z.object({
      type: z.string(),
      properties: z.record(z.any()).optional(),
      required: z.array(z.string()).optional(),
      description: z.string().optional(),
    }),
  }),
});

// Export camelCase alias for tools.ts compatibility
export const toolDefinitionSchema = openAIToolSchema;

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;
// Keep the ProviderConfig TypeScript type aligned with the full provider schema
export type ProviderConfig = z.infer<typeof ProviderConfigFullSchema>;
// Export a permissive ModelRegistry type for tests and runtime mocks
export type ModelRegistry = Record<string, any>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type McpIntegrationsConfig = z.infer<typeof McpIntegrationsSchema>;
// Application config Type
export type AppConfig = z.infer<typeof configSchema>;