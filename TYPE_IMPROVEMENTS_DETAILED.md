# TypeScript Type Improvements - Implementation Guide

This document provides detailed code examples and step-by-step instructions for implementing the type safety improvements identified in the type coverage analysis.

---

## 1. Create Centralized Types File

**File:** `src/core/types.ts` (NEW)

```typescript
/**
 * Centralized type definitions for the .daltoncli project
 * Single source of truth for all major interfaces
 */

import { ChatMessage } from './schemas';
import { Tool } from './tools';
import { DeltaChunk } from './stream_assembler';

/**
 * Unified interface for all AI provider implementations
 * All providers (OpenAI, Mistral, Gemini) must implement this interface
 */
export interface AIProvider {
  /**
   * Sends a chat completion request to the AI provider
   * @param messages - Array of chat messages
   * @param options - Configuration options for the request
   * @returns Stream of delta chunks representing the response
   */
  getChatCompletion(
    messages: ChatMessage[],
    options: {
      model: string;
      tools?: Tool[];
      tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    }
  ): Promise<AsyncIterable<DeltaChunk>>;
}

/**
 * Options for sending a chat request
 */
export interface ChatCompletionOptions {
  /** The model identifier (e.g., 'gpt-4', 'mistral-large') */
  model: string;

  /** Optional array of tools available to the model */
  tools?: Tool[];

  /** Tool selection strategy */
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };

  /** Optional timeout in milliseconds */
  timeout?: number;
}

/**
 * Configuration for an AI provider
 */
export interface ProviderConfig {
  api_key?: string;
  api_endpoint?: string;
  deployment_name?: string;  // Azure-specific
  api_version?: string;       // Azure-specific
  [key: string]: string | undefined;
}

/**
 * Configuration loaded from file
 */
export interface AppConfig {
  ai_providers?: Record<string, ProviderConfig>;
  [key: string]: unknown;
}

/**
 * Categorized error result
 */
export type ErrorCategory =
  | 'SESSION_ERROR'
  | 'PERMISSION_DENIED'
  | 'FILE_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'TIMEOUT_ERROR'
  | 'UNKNOWN_ERROR';

export interface CategorizedError {
  category: ErrorCategory;
  suggestion: string;
}

/**
 * Type guard: Check if value is a ChatMessage
 */
export function isChatMessage(value: unknown): value is ChatMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    'role' in value &&
    typeof (value as any).role === 'string'
  );
}

/**
 * Type guard: Check if value is an AIProvider
 */
export function isAIProvider(value: unknown): value is AIProvider {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getChatCompletion' in value &&
    typeof (value as any).getChatCompletion === 'function'
  );
}
```

---

## 2. Create Tool Transformation Helpers

**File:** `src/core/tool_transformers.ts` (NEW)

This file eliminates the need for double type assertions by providing proper type bridges.

```typescript
/**
 * Tool transformation helpers for different AI providers
 * Converts our unified Tool interface to provider-specific formats
 */

import { Tool } from './tools';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

/**
 * OpenAI-compatible tool definition
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * Transforms our unified Tool format to OpenAI format
 * @param tools - Array of tools in our unified format
 * @returns OpenAI-compatible tool definitions
 */
export function transformToolsForOpenAI(tools: Tool[] | undefined): OpenAITool[] | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }

  return tools.map(tool => {
    if (tool.type !== 'function') {
      throw new Error(`Invalid tool type: ${tool.type}. Only 'function' type is supported.`);
    }

    const func = tool.function;
    if (!func || typeof func !== 'object') {
      throw new Error('Tool must have a function property');
    }

    return {
      type: 'function' as const,
      function: {
        name: func.name,
        description: func.description,
        parameters: func.parameters as Record<string, unknown> | undefined,
      },
    };
  });
}

/**
 * Mistral-compatible tool definition
 */
export interface MistralTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

/**
 * Transforms our unified Tool format to Mistral format
 * @param tools - Array of tools in our unified format
 * @returns Mistral-compatible tool definitions
 */
export function transformToolsForMistral(tools: Tool[] | undefined): MistralTool[] | undefined {
  if (!tools || tools.length === 0) {
    return undefined;
  }

  return tools.map(tool => {
    if (tool.type !== 'function') {
      throw new Error(`Invalid tool type: ${tool.type}. Only 'function' type is supported.`);
    }

    const func = tool.function;
    if (!func || typeof func !== 'object') {
      throw new Error('Tool must have a function property');
    }

    return {
      type: 'function' as const,
      function: {
        name: func.name,
        description: func.description,
        parameters: func.parameters as Record<string, unknown> | undefined,
      },
    };
  });
}

/**
 * Transforms our ChatMessage to OpenAI ChatCompletionMessageParam
 * @param message - Message in our format
 * @returns OpenAI-compatible message
 */
export function transformMessageForOpenAI(message: any): ChatCompletionMessageParam {
  const base: any = {
    role: message.role,
  };

  if (message.content) {
    base.content = message.content;
  }

  if (message.tool_calls) {
    base.tool_calls = message.tool_calls;
  }

  if (message.tool_call_id) {
    base.tool_call_id = message.tool_call_id;
  }

  if (message.name) {
    base.name = message.name;
  }

  return base as ChatCompletionMessageParam;
}

/**
 * Mistral message structure
 */
export interface MistralMessage {
  role: string;
  content: string;
  tool_calls?: unknown[];
}

/**
 * Transforms our ChatMessage to Mistral format
 * @param message - Message in our format
 * @returns Mistral-compatible message
 */
export function transformMessageForMistral(message: any): MistralMessage {
  return {
    role: message.role,
    content: message.content || '',
    ...(message.tool_calls && { tool_calls: message.tool_calls }),
  };
}

/**
 * Transforms array of messages for OpenAI
 */
export function transformMessagesForOpenAI(messages: any[]): ChatCompletionMessageParam[] {
  return messages.map(transformMessageForOpenAI);
}

/**
 * Transforms array of messages for Mistral
 */
export function transformMessagesForMistral(messages: any[]): MistralMessage[] {
  return messages.map(transformMessageForMistral);
}
```

---

## 3. Refactor Provider Implementations

### OpenAI Provider - Before and After

**Before (`src/providers/openai_provider.ts` - Lines 287-292):**
```typescript
result = await this.client.chat.completions.create(
  {
    messages,
    model: modelOrDeployment,
    tools: tools as unknown as Parameters<typeof this.client.chat.completions.create>[0]['tools'],
    tool_choice: tool_choice as unknown as Parameters<typeof this.client.chat.completions.create>[0]['tool_choice'],
    stream: true,
  },
  {
    signal,
    timeout: timeoutMs,
  } as RequestOptions  // ← problematic cast
);
```

**After:**
```typescript
// At top of file, add import
import { transformToolsForOpenAI, transformMessagesForOpenAI } from '../core/tool_transformers';
import { AIProvider as AIProviderType, ChatCompletionOptions } from '../core/types';

// Replace entire request section:
const transformedMessages = transformMessagesForOpenAI(messages);
const transformedTools = transformToolsForOpenAI(tools);

// Type-safe request without casting
const openAIRequest = {
  messages: transformedMessages,
  model: modelOrDeployment,
  ...(transformedTools && { tools: transformedTools }),
  ...(tool_choice && { tool_choice }),
  stream: true as const,
};

result = await this.client.chat.completions.create(
  openAIRequest,
  { signal, timeout: timeoutMs }
);
```

### Mistral Provider - Before and After

**Before (`src/providers/mistral_provider.ts` - Lines 297-302):**
```typescript
result = this.client.chat.stream({
  model,
  messages: transformedMessages as unknown as Parameters<typeof this.client.chat.stream>[0]['messages'],
  ...(tools && { tools: tools as unknown as Parameters<typeof this.client.chat.stream>[0]['tools'] }),
  ...(tool_choice && { toolChoice: tool_choice as unknown as Parameters<typeof this.client.chat.stream>[0]['toolChoice'] }),
});
```

**After:**
```typescript
import { transformToolsForMistral, transformMessagesForMistral } from '../core/tool_transformers';

// Properly transform types
const mistralMessages = transformMessagesForMistral(messages);
const mistralTools = transformToolsForMistral(tools);

// Type-safe call
const mistralRequest = {
  model,
  messages: mistralMessages,
  ...(mistralTools && { tools: mistralTools }),
  ...(tool_choice && { toolChoice: tool_choice }),
};

result = this.client.chat.stream(mistralRequest);
```

---

## 4. Fix ChatMessage Type Issues

**File:** `src/core/schemas.ts`

**Before:**
```typescript
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
```

**After:**
```typescript
// More comprehensive ChatMessage schema
export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string().optional(),
  tool_calls: z.array(z.object({
    id: z.string(),
    type: z.literal('function'),
    function: z.object({
      name: z.string(),
      arguments: z.string(),
    }),
  })).optional(),
  tool_call_id: z.string().optional(),
  tool_call: z.unknown().optional(),  // For Mistral compatibility
  name: z.string().optional(),        // For tool messages
});

// Export inferred TypeScript type
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// Validation helper
export function validateChatMessage(msg: unknown): ChatMessage {
  return ChatMessageSchema.parse(msg);
}
```

**Update typing in schemas:**
```typescript
// If ChatMessage is defined as interface, update to:
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  tool_call?: unknown;  // Mistral compatibility
  name?: string;        // Tool message name
}
```

This eliminates the need for `(msg as any).role` casts because `role` is now explicitly typed.

---

## 5. Fix Error Categorization

**File:** `src/commands/chat.ts` - Replace `categorizeError` function

**Before:**
```typescript
const categorizeError = (error: any): { category: string; suggestion: string } => {
  if (error instanceof SessionError) {
    return {
      category: 'SESSION ERROR',
      suggestion: 'Try using --list-sessions to see available sessions or check the session directory.'
    };
  }

  const errCode = (error as NodeJS.ErrnoException)?.code;
  // ... more error handling
}
```

**After:**
```typescript
import { CategorizedError, ErrorCategory } from '../core/types';

function categorizeError(error: unknown): CategorizedError {
  // Type-safe error categorization without 'any'

  if (error instanceof SessionError) {
    return {
      category: 'SESSION_ERROR',
      suggestion: 'Try using --list-sessions to see available sessions or check the session directory.'
    };
  }

  if (!(error instanceof Error)) {
    return {
      category: 'UNKNOWN_ERROR',
      suggestion: 'An unexpected error occurred. Please check the logs for details.'
    };
  }

  // Type-safe error code checking
  const nodeError = error as NodeJS.ErrnoException;
  const errCode = nodeError?.code;

  if (errCode === 'EACCES') {
    return {
      category: 'PERMISSION_DENIED',
      suggestion: 'Check file permissions or run with appropriate access rights.'
    };
  }

  if (errCode === 'ENOENT') {
    return {
      category: 'FILE_NOT_FOUND',
      suggestion: 'The file or directory does not exist. Check the path and try again.'
    };
  }

  if (errCode === 'ETIMEDOUT') {
    return {
      category: 'TIMEOUT_ERROR',
      suggestion: 'The operation timed out. Try again or increase the timeout value.'
    };
  }

  if (error.message.includes('401') || error.message.includes('Unauthorized')) {
    return {
      category: 'AUTHENTICATION_ERROR',
      suggestion: 'Check your API credentials and try again.'
    };
  }

  if (error.message.includes('429') || error.message.includes('rate limit')) {
    return {
      category: 'UNKNOWN_ERROR',  // Would be RATE_LIMIT if that existed
      suggestion: 'Rate limit exceeded. Please wait a moment and try again.'
    };
  }

  return {
    category: 'UNKNOWN_ERROR',
    suggestion: `Error: ${error.message}`
  };
}
```

---

## 6. Remove Duplicate Interfaces

### Step 1: Update `src/core/provider_wrapper.ts`

**Before:**
```typescript
export interface AIProvider {
  getChatCompletion(
    messages: ChatMessage[],
    options: {
      model: string;
      tools?: Tool[];
      tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
    }
  ): Promise<AsyncIterable<any>>;
}
```

**After - Replace with import:**
```typescript
// At top of file
import { AIProvider } from './types';  // Single source of truth

// Remove the interface definition entirely
```

### Step 2: Update `src/core/api_client.ts`

**Before:**
```typescript
interface AIProvider {
  getChatCompletion(messages: unknown[], options: ChatCompletionOptions): Promise<AsyncIterable<unknown>>;
}

interface ChatCompletionOptions {
  model: string;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
}
```

**After:**
```typescript
// Import unified types
import { AIProvider, ChatCompletionOptions } from './types';

// Remove both interface definitions - they're now in types.ts
```

### Step 3: Update `src/commands/chat.ts`

**Before:**
```typescript
interface AIProvider {
  providerName: string;
  getChatCompletion(
    messages: ChatMessage[],
    options: { model: string; tools: Tool[]; tool_choice: string }
  ): Promise<AsyncIterable<DeltaChunk>>;
}
```

**After:**
```typescript
import { AIProvider } from '../core/types';

// Remove the interface definition
```

---

## 7. Fix Stream Assembly Types

**File:** `src/core/stream_assembler.ts`

**Keep the DeltaChunk and ToolCall interfaces here** (they're specific to stream assembly), but **export from central types as well for convenience**:

```typescript
// At end of stream_assembler.ts
export { DeltaChunk, ToolCall } from '../core/types';  // Re-export for convenience

// Or update types.ts to import and re-export from here
// This avoids duplication while maintaining logical organization
```

---

## 8. Create Type Guard Utilities

**File:** `src/core/type_guards.ts` (NEW)

```typescript
/**
 * Type guard functions for runtime type checking
 * Used when working with unknown or dynamic data
 */

import { ChatMessage, ToolCall, Tool } from './types';
import { DeltaChunk, ToolCallDelta } from './stream_assembler';

/**
 * Check if value is a valid ChatMessage
 */
export function isChatMessage(value: unknown): value is ChatMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const msg = value as Record<string, unknown>;

  // Must have role
  if (!('role' in msg) || typeof msg.role !== 'string') {
    return false;
  }

  const role = msg.role as string;
  if (!['user', 'assistant', 'system', 'tool'].includes(role)) {
    return false;
  }

  // Tool messages must have tool_call_id and name
  if (role === 'tool') {
    return 'tool_call_id' in msg && 'name' in msg && 'content' in msg;
  }

  // All other messages must have content (unless they have tool_calls)
  if ('tool_calls' in msg) {
    return Array.isArray(msg.tool_calls);
  }

  return 'content' in msg && typeof msg.content === 'string';
}

/**
 * Check if value is a valid ToolCall
 */
export function isToolCall(value: unknown): value is ToolCall {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const call = value as Record<string, unknown>;

  return (
    'id' in call && typeof call.id === 'string' &&
    'type' in call && call.type === 'function' &&
    'function' in call &&
    typeof call.function === 'object' &&
    call.function !== null &&
    'name' in call.function && typeof (call.function as any).name === 'string' &&
    'arguments' in call.function && typeof (call.function as any).arguments === 'string'
  );
}

/**
 * Check if value is a valid Tool
 */
export function isTool(value: unknown): value is Tool {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const tool = value as Record<string, unknown>;

  return (
    'type' in tool && tool.type === 'function' &&
    'function' in tool &&
    typeof tool.function === 'object' &&
    tool.function !== null &&
    'name' in tool.function &&
    'description' in tool.function
  );
}

/**
 * Check if value is a DeltaChunk
 */
export function isDeltaChunk(value: unknown): value is DeltaChunk {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const chunk = value as Record<string, unknown>;

  return (
    'choices' in chunk &&
    Array.isArray(chunk.choices) &&
    chunk.choices.length > 0 &&
    typeof chunk.choices[0] === 'object' &&
    chunk.choices[0] !== null &&
    ('delta' in chunk.choices[0])
  );
}

/**
 * Assert value is a ChatMessage, throw if not
 */
export function assertChatMessage(value: unknown): asserts value is ChatMessage {
  if (!isChatMessage(value)) {
    throw new TypeError('Value is not a valid ChatMessage');
  }
}

/**
 * Assert value is a ToolCall, throw if not
 */
export function assertToolCall(value: unknown): asserts value is ToolCall {
  if (!isToolCall(value)) {
    throw new TypeError('Value is not a valid ToolCall');
  }
}
```

---

## 9. Update Provider Constructor Type Safety

**File:** `src/core/provider_wrapper.ts`

**Before:**
```typescript
try {
  this.provider = getProvider(providerName) as unknown as AIProvider;
} catch (error) {
  // ...
}
```

**After:**
```typescript
import { isAIProvider } from './types';

try {
  const provider = getProvider(providerName);

  if (!isAIProvider(provider)) {
    throw new TypeError(`Provider '${providerName}' does not implement AIProvider interface`);
  }

  this.provider = provider;
} catch (error) {
  // ...
}
```

---

## 10. Update Shell Command Typing

**File:** `src/commands/shell.ts`

**Before:**
```typescript
const execOptions: any = {
  timeout: shellLimits.execTimeout,
  shell: shellExecutable,
};
```

**After:**
```typescript
import { ExecOptions } from 'child_process';

// Create properly typed options object
const execOptions: ExecOptions = {
  timeout: shellLimits.execTimeout,
  shell: shellExecutable,
  maxBuffer: 1024 * 1024 * 10,  // 10MB buffer
};
```

Or define custom type for your needs:
```typescript
interface ShellExecOptions {
  timeout: number;
  shell: string;
  maxBuffer?: number;
  env?: NodeJS.ProcessEnv;
}

const execOptions: ShellExecOptions = {
  timeout: shellLimits.execTimeout,
  shell: shellExecutable,
};
```

---

## 11. Improve Flow Context Typing

**File:** `src/core/flow_runner.ts`

**Before:**
```typescript
type FlowContextValue = string | number | boolean | object | null | undefined;

interface FlowContext {
  [key: string]: FlowContextValue;
}
```

**After:**
```typescript
// More specific value type
type FlowContextValue =
  | string
  | number
  | boolean
  | Record<string, unknown>  // ← More specific than 'object'
  | unknown[]
  | null
  | undefined;

interface FlowContext {
  [key: string]: FlowContextValue;
}

// Add validation helper
function isValidFlowValue(value: unknown): value is FlowContextValue {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    value === null ||
    value === undefined ||
    (typeof value === 'object' && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype))
  );
}
```

---

## 12. Implementation Checklist

- [ ] Create `src/core/types.ts` with unified interfaces
- [ ] Create `src/core/tool_transformers.ts` with transformation helpers
- [ ] Create `src/core/type_guards.ts` with type guard functions
- [ ] Update `src/core/provider_wrapper.ts` to import AIProvider from types.ts
- [ ] Remove duplicate AIProvider from `src/core/api_client.ts`
- [ ] Remove duplicate AIProvider from `src/commands/chat.ts`
- [ ] Update `src/providers/openai_provider.ts` to use transformers
- [ ] Update `src/providers/mistral_provider.ts` to use transformers
- [ ] Update `src/providers/gemini_provider.ts` to use transformers
- [ ] Update `src/commands/chat.ts` error handling
- [ ] Update `src/commands/shell.ts` with proper ExecOptions type
- [ ] Update `src/core/flow_runner.ts` with better FlowContextValue type
- [ ] Test compilation: `npm run build` or `npx tsc --noEmit`
- [ ] Run tests if available: `npm test`
- [ ] Test chat functionality with multiple providers

---

## 13. Testing Strategy

After implementing these changes, test with:

```bash
# Type check without emit
npx tsc --noEmit

# Build the project
npm run build

# Run any existing tests
npm test

# Manual testing with each provider
npx dalton-cli chat --provider openai --model gpt-4
npx dalton-cli chat --provider mistral --model mistral-large
npx dalton-cli chat --provider gemini --model gemini-pro

# Test with tools
npx dalton-cli chat --provider openai "Use the shell command tool to list files"
```

---

## 14. Benefits Summary

| Improvement | Benefit |
|-------------|---------|
| Unified AIProvider interface | Single source of truth, easier maintenance |
| AsyncIterable<DeltaChunk> | Type-safe stream iteration |
| Tool transformers | No more double type assertions |
| Type guards | Runtime safety without casts |
| ChatMessage typing | No more `as any` on role property |
| Error categorization types | Exhaustive error handling |
| Central types file | Better organization |

---

## Next Steps

1. **Start with Phase 1** (High Impact - 2-3 hours)
   - Create central types file
   - Consolidate AIProvider
   - Update return types

2. **Move to Phase 2** (Medium Impact - 2-3 hours)
   - Create transformers
   - Update providers
   - Create type guards

3. **Complete Phase 3** (Nice to Have - 1-2 hours)
   - Improve error handling
   - Update remaining any types
   - Add validation helpers

4. **Test thoroughly** with all providers and edge cases
