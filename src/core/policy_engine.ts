import { ChatMessage, ModelRegistry } from './schemas';
import { aiProviders, config } from '../config';
import { getPolicyLimits } from './app_limits';

const TOOL_CALL_RATIONALE_PHRASE = 'I am requesting a tool call to';

export interface ModelRoutingOptions {
  forceModel?: string; // Allow overriding policy for specific cases
}

export function determineModel(message: ChatMessage, modelRegistry: ModelRegistry, options?: ModelRoutingOptions): string {
  if (options?.forceModel) {
    return options.forceModel;
  }

  const policyLimits = getPolicyLimits();

  // Check for code blocks to elevate model
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks = message.content?.match(codeBlockRegex) || [];

  // Prefer explicit values from the lightweight runtime `config` object (this allows tests to mock config)
  for (const block of codeBlocks) {
    const lines = block.split('\n').length;
    if (lines > policyLimits.codeBlockThreshold) {
      if (config && (config as any).elevatedModel && modelRegistry[(config as any).elevatedModel]) {
        return (config as any).elevatedModel;
      }
      // Fallback to provider config (e.g., openai) if available
  const defaultProviderConfig = aiProviders?.openai;
      if (defaultProviderConfig && defaultProviderConfig.default_model && modelRegistry[defaultProviderConfig.default_model]) {
        return defaultProviderConfig.default_model;
      }
    }
  }

  // Default to the configured default model from runtime config first
  if (config && (config as any).defaultChatModel && modelRegistry[(config as any).defaultChatModel]) {
    return (config as any).defaultChatModel;
  }

  // Fallback to provider config (e.g., openai) if available
  const defaultProviderConfig = aiProviders?.openai;
  if (defaultProviderConfig && defaultProviderConfig.default_model && modelRegistry[defaultProviderConfig.default_model]) {
    return defaultProviderConfig.default_model;
  }

  // Fallback to the first available model if defaults are not found
  const firstModel = Object.keys(modelRegistry)[0];
  if (firstModel) {
    return firstModel;
  }

  throw new Error("No suitable model found in registry.");
}

export function validateToolCall(assistantMessage: ChatMessage): boolean {
  if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
    return true; // No tool calls, so no validation needed
  }

  if (!assistantMessage.content) {
    return false; // Tool call without any content/rationale is not allowed
  }

  // Check if the assistant's message contains the required rationale phrase
  const hasRationale = assistantMessage.content.includes(TOOL_CALL_RATIONALE_PHRASE);

  if (!hasRationale) {
    console.warn("Tool call blocked: Assistant message does not contain the required rationale phrase.");
  }

  return hasRationale;
}
