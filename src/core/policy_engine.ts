import { ChatMessage } from './schemas';
import { modelRegistry, ModelRegistry } from './model_registry';
import { config } from '../config'; // Import config

const CODE_BLOCK_THRESHOLD = 10; // N lines
const TOOL_CALL_RATIONALE_PHRASE = 'I am requesting a tool call to';

export interface ModelRoutingOptions {
  forceModel?: string; // Allow overriding policy for specific cases
}

export function determineModel(message: ChatMessage, modelRegistry: ModelRegistry, options?: ModelRoutingOptions): string {
  if (options?.forceModel) {
    return options.forceModel;
  }

  // Check for code blocks to elevate model
  const codeBlockRegex = /```[\s\S]*?```/g;
  const codeBlocks = message.content?.match(codeBlockRegex) || [];

  for (const block of codeBlocks) {
    const lines = block.split('\n').length;
    if (lines > CODE_BLOCK_THRESHOLD) {
      // Elevate to a better model if available and configured
      if (config.elevatedModel && modelRegistry[config.elevatedModel]) {
        return config.elevatedModel;
      }
    }
  }

  // Default to a cheap fast model if configured
  if (config.defaultChatModel && modelRegistry[config.defaultChatModel]) {
    return config.defaultChatModel;
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
