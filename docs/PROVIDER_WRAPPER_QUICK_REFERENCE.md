# Provider Wrapper - Quick Reference

## One-Line Summary
Unified API for all AI providers with consistent streaming, error handling, and tool support.

---

## Quick Start

```typescript
import { getProviderWrapper } from './core/api_client';

const wrapper = getProviderWrapper('openai');
const response = await wrapper.sendChat(
  [{ role: 'user', content: 'Hello!' }],
  { model: 'gpt-4' }
);
```

---

## API Cheat Sheet

### Create Wrapper
```typescript
const wrapper = getProviderWrapper('openai');  // or 'mistral', 'gemini', 'azure', 'groq'
```

### Send Chat
```typescript
const response = await wrapper.sendChat(messages, options);
```

### Options Object
```typescript
{
  model: string,              // Required: 'gpt-4', 'mistral-large', etc.
  tools?: Tool[],             // Optional: Available functions
  tool_choice?: 'auto' | ..., // Optional: Tool selection strategy
  onContent?: (chunk) => {},  // Optional: Streaming callback
  timeout?: number            // Optional: Not yet implemented
}
```

### Response Object
```typescript
{
  content: string,            // Complete response text
  toolCalls: ToolCall[],      // Array of tool calls (may be empty)
  metadata?: { ... }          // Optional provider metadata
}
```

---

## Common Patterns

### Basic Chat
```typescript
const response = await wrapper.sendChat(
  [{ role: 'user', content: 'Hello!' }],
  { model: 'gpt-4' }
);
console.log(response.content);
```

### Streaming Output
```typescript
await wrapper.sendChat(messages, {
  model: 'gpt-4',
  onContent: chunk => process.stdout.write(chunk)
});
```

### With Tools
```typescript
const response = await wrapper.sendChat(messages, {
  model: 'gpt-4',
  tools: myTools,
  tool_choice: 'auto'
});

if (response.toolCalls.length > 0) {
  // Handle tool execution
}
```

### Error Handling
```typescript
import { isProviderError, isRetryableError } from './core/provider_wrapper';

try {
  const response = await wrapper.sendChat(messages, options);
} catch (error) {
  if (isProviderError(error)) {
    console.error(`${error.providerName} failed: ${error.message}`);
    if (isRetryableError(error)) {
      // Retry logic
    }
  }
}
```

### Retry with Backoff
```typescript
async function sendWithRetry(messages, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await wrapper.sendChat(messages, options);
    } catch (error) {
      if (!isRetryableError(error) || i === maxRetries - 1) throw error;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
}
```

---

## Migration from Old API

### Before (Direct Provider)
```typescript
const provider = getProvider('openai');
const stream = await provider.getChatCompletion(messages, { model, tools, tool_choice });
const { content, toolCallsRaw } = await assembleDeltaStream(stream, onContent);
```

### After (Provider Wrapper)
```typescript
const wrapper = getProviderWrapper('openai');
const { content, toolCalls } = await wrapper.sendChat(messages, { model, tools, tool_choice, onContent });
```

**Changes:**
- `getProvider` → `getProviderWrapper`
- `getChatCompletion` → `sendChat`
- No need to import/call `assembleDeltaStream`
- `toolCallsRaw` → `toolCalls`
- `onContent` is now in options object

---

## Error Types

| Error | Cause | Retryable |
|-------|-------|-----------|
| `ProviderConfigurationError` | Missing API key, invalid config | No |
| `ProviderRequestError` | Network, rate limit, invalid params | Maybe* |
| `ProviderStreamError` | Malformed response, connection drop | No |
| `ProviderError` | Generic provider error | No |

*Check `error.isRetryable` property

---

## Supported Providers

| Provider | Name | Example Model |
|----------|------|---------------|
| OpenAI | `'openai'` | `'gpt-4'`, `'gpt-3.5-turbo'` |
| Mistral | `'mistral'` | `'mistral-large'`, `'mistral-small'` |
| Gemini | `'gemini'` | `'gemini-pro'`, `'gemini-1.5-pro'` |
| Azure OpenAI | `'azure'` | (configured in Azure) |
| Groq | `'groq'` | `'llama-3'`, `'mixtral-8x7b'` |

---

## Tool Call Structure

```typescript
{
  id: string,              // Unique identifier
  function: {
    name: string,          // Function name to call
    arguments: string      // JSON string of arguments
  }
}
```

### Handling Tool Calls
```typescript
if (response.toolCalls.length > 0) {
  for (const tc of response.toolCalls) {
    const args = JSON.parse(tc.function.arguments);
    const result = await executeFunction(tc.function.name, args);

    messages.push({
      role: 'tool',
      tool_call_id: tc.id,
      content: result
    });
  }

  // Send follow-up request with tool results
  const followUp = await wrapper.sendChat(messages, options);
}
```

---

## Best Practices

1. **Use wrapper for new code** (not direct provider access)
2. **Handle errors specifically** (check `isProviderError`, `isRetryableError`)
3. **Show progress** (use `onContent` callback for UX)
4. **Validate tool calls** (parse JSON, handle errors)
5. **Reuse instances** (create wrapper once, use multiple times)

---

## Common Gotchas

### Empty Content with Tool Calls
```typescript
// This is NORMAL - not an error
if (response.content === '' && response.toolCalls.length > 0) {
  // Model is requesting tool execution
}
```

### onContent Not Called
- Provider may not support streaming
- Model may return everything at once
- Tool calls are typically non-streamed

### Different Response Times
- Streaming: Fast time-to-first-token, better UX
- Non-streaming: Same total time, all-at-once delivery

---

## Performance Tips

- **Concurrent requests**: Wrappers are safe to use in parallel
  ```typescript
  const responses = await Promise.all([
    wrapper.sendChat(msgs1, opts),
    wrapper.sendChat(msgs2, opts),
  ]);
  ```

- **Memory**: Large responses accumulate in memory
  ```typescript
  onContent: chunk => fs.appendFileSync('out.txt', chunk)
  ```

- **Reuse**: Create wrapper once, reuse for multiple calls
  ```typescript
  const wrapper = getProviderWrapper('openai');  // Once
  await wrapper.sendChat(msgs1, opts);           // Many times
  await wrapper.sendChat(msgs2, opts);
  ```

---

## Debugging

### Get Provider Name
```typescript
console.log(wrapper.getProviderName()); // 'openai'
```

### Log Errors
```typescript
catch (error) {
  if (isProviderError(error)) {
    console.error({
      provider: error.providerName,
      message: error.message,
      retryable: error.isRetryable,
      original: error.originalError
    });
  }
}
```

### Track Streaming
```typescript
let chunkCount = 0;
onContent: (chunk) => {
  console.log(`Chunk ${++chunkCount}: ${chunk.length} chars`);
}
```

---

## TypeScript Types

```typescript
import type {
  ProviderWrapper,
  SendChatOptions,
  SendChatResponse,
  ToolCall,
  ResponseMetadata
} from './core/provider_wrapper';

import {
  ProviderError,
  ProviderConfigurationError,
  ProviderRequestError,
  ProviderStreamError,
  isProviderError,
  isRetryableError
} from './core/provider_wrapper';
```

---

## See Full Documentation

- [Complete Guide](./PROVIDER_WRAPPER.md) - Detailed documentation
- [Examples](../examples/provider_wrapper_example.ts) - Code examples
- [Architecture](./PROVIDER_WRAPPER.md#architecture) - Design details

---

## Quick Links

- [Basic Usage](#basic-chat)
- [Streaming](#streaming-output)
- [Tool Calls](#with-tools)
- [Error Handling](#error-handling)
- [Migration Guide](#migration-from-old-api)
