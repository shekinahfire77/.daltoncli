/**
 * daltoncli Configuration Types
 * TypeScript interfaces for the config.json structure
 */

export interface RetryConfig {
  max_retries: number;
  initial_delay_ms: number;
  backoff_multiplier: number;
  max_delay_ms: number;
}

export interface ModelConfig {
  id: string;
  name: string;
  capabilities: string[];
  max_tokens: number;
  cost_per_1k_input?: number;
  cost_per_1k_output?: number;
}

export interface BaseProviderConfig {
  enabled: boolean;
  api_key_env: string;
  base_url: string;
  default_model: string;
  timeout_seconds: number;
  models: ModelConfig[];
  retry_config: RetryConfig;
}

export interface OpenAIConfig extends BaseProviderConfig {
  api_key_env: "OPENAI_API_KEY";
  base_url: "https://api.openai.com/v1";
}

export interface GoogleConfig extends BaseProviderConfig {
  api_key_env: "GOOGLE_API_KEY";
  base_url: "https://generativelanguage.googleapis.com";
}

export interface MistralConfig extends BaseProviderConfig {
  api_key_env: "MISTRAL_API_KEY";
  base_url: "https://api.mistral.ai/v1";
}

export interface AzureConfig extends BaseProviderConfig {
  api_key_env: "AZURE_OPENAI_API_KEY";
  deployment_name: string;
  resource_name: string;
  api_version: string;
  endpoint_env: "AZURE_OPENAI_ENDPOINT";
}

export interface GroqConfig extends BaseProviderConfig {
  api_key_env: "GROQ_API_KEY";
  base_url: "https://api.groq.com/openai/v1";
}

export interface AIProviders {
  _comment?: string;
  openai: OpenAIConfig;
  azure: AzureConfig;
  google: GoogleConfig;
  mistral: MistralConfig;
  groq: GroqConfig;
}

export interface MCPServer {
  _comment?: string;
  name: string;
  enabled: boolean;
  command: string;
  args: string[];
  timeout_seconds: number;
  environment?: Record<string, string>;
}

export interface MCPIntegrations {
  _comment?: string;
  enabled: boolean;
  servers: MCPServer[];
  auto_discovery: boolean;
  discovery_paths: string[];
}

export interface RuntimeSettings {
  _comment?: string;
  environment: "production" | "staging" | "development";
  debug: boolean;
  log_level: "error" | "warn" | "info" | "debug" | "trace";
  cache_enabled: boolean;
  cache_ttl_seconds: number;
  max_concurrent_requests: number;
  request_timeout_seconds: number;
}

export interface FallbackStrategy {
  _comment?: string;
  enabled: boolean;
  fallback_chain: string[];
  retry_on_rate_limit: boolean;
  max_total_retries: number;
}

export interface DaltoncliConfig {
  _description: string;
  _version: string;
  _documentation: string;
  ai_providers: AIProviders;
  mcp_integrations: MCPIntegrations;
  runtime_settings: RuntimeSettings;
  fallback_strategy: FallbackStrategy;
}

// Type guards
export function isValidProvider(
  provider: string
): provider is keyof Omit<AIProviders, "_comment"> {
  return ["openai", "azure", "google", "mistral", "groq"].includes(provider);
}

export function isConfigEnabled(config: DaltoncliConfig, provider: string): boolean {
  if (!isValidProvider(provider)) return false;
  return config.ai_providers[provider]?.enabled ?? false;
}

export function getDefaultModel(config: DaltoncliConfig, provider: string): string | null {
  if (!isValidProvider(provider)) return null;
  return config.ai_providers[provider]?.default_model ?? null;
}

export function getAvailableModels(config: DaltoncliConfig, provider: string): ModelConfig[] {
  if (!isValidProvider(provider)) return [];
  return config.ai_providers[provider]?.models ?? [];
}
