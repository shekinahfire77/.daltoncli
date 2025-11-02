# Provider Wrapper - Unified AI Provider API

## Overview

The Provider Wrapper is a unified abstraction layer for interacting with multiple AI providers (OpenAI, Mistral, Gemini, etc.) in the .daltoncli project. It provides a consistent interface regardless of the underlying provider, handling provider-specific quirks internally.

## Key Benefits

1. **Consistent API**: Single `sendChat()` method works with all providers
2. **Simplified Code**: Reduces boilerplate in consumer code
3. **Normalized Responses**: Consistent response format across providers
4. **Better Error Handling**: Categorized errors with retry-ability information
5. **Real-time Streaming**: Built-in callback support for live content display
6. **Maintainability**: Easy to add new providers without changing consumer code

## Quick Start

### Basic Usage

```typescript
import { getProviderWrapper } from './core/api_client';

// Create a wrapper for your chosen provider
const wrapper = getProviderWrapper('openai');

// Send a chat request
const response = await wrapper.sendChat(
  [{ role: 'user', content: 'Hello, AI!' }],
  { model: 'gpt-4' }
);

console.log(response.content); // "Hello! How can I help you today?"
```

### With Real-time Streaming

```typescript
const wrapper = getProviderWrapper('mistral');

const response = await wrapper.sendChat(
  [{ role: 'user', content: 'Write a poem about TypeScript' }],
  {
    model: 'mistral-large',
    onContent: (chunk) => {
      // Display content as it arrives
      process.stdout.write(chunk);
    }
  }
);

// Response is complete when promise resolves
console.log('\n\nComplete response:', response.content);
```

### With Tool Calls

```typescript
import { tools } from './core/tools';

const wrapper = getProviderWrapper('gemini');

const response = await wrapper.sendChat(
  [{ role: 'user', content: 'What files are in the current directory?' }],
  {
    model: 'gemini-pro',
    tools: tools,
    tool_choice: 'auto'
  }
);

// Check if model requested tool calls
if (response.toolCalls.length > 0) {
  console.log('Model wants to call tools:');
  response.toolCalls.forEach(tc => {
    console.log(`- ${tc.function.name}(${tc.function.arguments})`);
  });
}
```

## API Reference

### `getProviderWrapper(providerName: string): ProviderWrapper`

Factory function to create a provider wrapper instance.

**Parameters:**
- `providerName`: Provider identifier ('openai', 'mistral', 'gemini', 'azure', 'groq')

**Returns:** `ProviderWrapper` instance

**Throws:** `ProviderConfigurationError` if provider is not configured

**Example:**
```typescript
const wrapper = getProviderWrapper('openai');
```

---

### `ProviderWrapper.sendChat(messages, options): Promise<SendChatResponse>`

Sends a chat request to the underlying provider.

**Parameters:**

#### `messages: ChatMessage[]`
Array of chat messages. Each message has:
- `role`: 'user' | 'assistant' | 'system' | 'tool'
- `content?`: Message text
- `tool_calls?`: Array of tool calls (for assistant messages)
- `tool_call_id?`: ID of tool call this responds to (for tool messages)

#### `options: SendChatOptions`
Configuration object:
- `model` (required): Model identifier (e.g., 'gpt-4', 'mistral-large')
- `tools?`: Array of available tools
- `tool_choice?`: 'auto' | 'none' | specific function selection
- `onContent?`: Callback function `(chunk: string) => void` for streaming
- `timeout?`: Request timeout in milliseconds (not yet implemented)

**Returns:** `Promise<SendChatResponse>`

Response object contains:
- `content`: Complete accumulated response text
- `toolCalls`: Array of tool calls requested by the model
  - Each has `id`, `function.name`, and `function.arguments`
- `metadata?`: Optional provider-specific metadata (tokens, model, etc.)

**Throws:**
- `ProviderRequestError`: Request failed (check `isRetryable` property)
- `ProviderStreamError`: Stream processing failed
- `ProviderConfigurationError`: Provider not properly configured
- `ProviderError`: Generic provider error

---

### `ProviderWrapper.getProviderName(): string`

Returns the name of the wrapped provider.

**Example:**
```typescript
const wrapper = getProviderWrapper('openai');
console.log(wrapper.getProviderName()); // "openai"
```

---

## Error Handling

The wrapper provides detailed error information with categorization:

```typescript
import { isProviderError, isRetryableError } from './core/provider_wrapper';

try {
  const response = await wrapper.sendChat(messages, options);
} catch (error) {
  if (isProviderError(error)) {
    console.error(`Provider ${error.providerName} failed: ${error.message}`);

    if (isRetryableError(error)) {
      console.log('Error is retryable, attempting retry...');
      // Implement retry logic
    }

    // Access original error if needed
    if (error.originalError) {
      console.error('Original error:', error.originalError);
    }
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Error Types

#### `ProviderConfigurationError`
- **Cause**: Provider not configured, missing API key, invalid configuration
- **Retryable**: No
- **Fix**: Check provider configuration

#### `ProviderRequestError`
- **Cause**: API request failed (network, rate limit, invalid parameters)
- **Retryable**: Sometimes (check `isRetryable` property)
- **Fix**: Check network, rate limits, request parameters

#### `ProviderStreamError`
- **Cause**: Stream processing failed (malformed response, connection dropped)
- **Retryable**: No
- **Fix**: Check provider status, report if persistent

#### `ProviderError`
- **Cause**: Generic provider error
- **Retryable**: No (by default)
- **Fix**: Check error message for details

---

## Advanced Usage

### Error Recovery with Retry

```typescript
async function sendWithRetry(
  wrapper: ProviderWrapper,
  messages: ChatMessage[],
  options: SendChatOptions,
  maxRetries = 3
): Promise<SendChatResponse> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await wrapper.sendChat(messages, options);
    } catch (error) {
      lastError = error as Error;

      if (!isRetryableError(error)) {
        // Not retryable, throw immediately
        throw error;
      }

      if (attempt < maxRetries - 1) {
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Retry ${attempt + 1}/${maxRetries} after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// Usage
const response = await sendWithRetry(wrapper, messages, options, 3);
```

### Multi-turn Conversation

```typescript
const wrapper = getProviderWrapper('openai');
const conversationHistory: ChatMessage[] = [
  { role: 'system', content: 'You are a helpful assistant.' }
];

async function chat(userMessage: string): Promise<string> {
  // Add user message to history
  conversationHistory.push({ role: 'user', content: userMessage });

  // Get AI response
  const response = await wrapper.sendChat(conversationHistory, {
    model: 'gpt-4',
    onContent: (chunk) => process.stdout.write(chunk)
  });

  // Add assistant response to history
  conversationHistory.push({ role: 'assistant', content: response.content });

  return response.content;
}

// Use it
await chat('What is TypeScript?');
await chat('How does it differ from JavaScript?');
await chat('Should I use it for my project?');
```

### Tool Call Execution Loop

```typescript
import { tools } from './core/tools';

async function chatWithTools(userMessage: string) {
  const wrapper = getProviderWrapper('openai');
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are a helpful assistant with tool access.' },
    { role: 'user', content: userMessage }
  ];

  while (true) {
    const response = await wrapper.sendChat(messages, {
      model: 'gpt-4',
      tools: tools,
      tool_choice: 'auto'
    });

    if (response.toolCalls.length === 0) {
      // No tool calls, conversation complete
      return response.content;
    }

    // Add assistant message with tool calls to history
    messages.push({
      role: 'assistant',
      tool_calls: response.toolCalls
    });

    // Execute each tool call
    for (const toolCall of response.toolCalls) {
      const result = await executeToolCall(toolCall);
      messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result
      });
    }

    // Continue loop to get AI's response to tool results
  }
}
```

### Provider Switching

```typescript
// Try multiple providers in order of preference
const providers = ['openai', 'mistral', 'gemini'];

async function sendChatWithFallback(
  messages: ChatMessage[],
  model: string
): Promise<SendChatResponse> {
  for (const providerName of providers) {
    try {
      const wrapper = getProviderWrapper(providerName);
      return await wrapper.sendChat(messages, { model });
    } catch (error) {
      console.warn(`Provider ${providerName} failed, trying next...`);
      if (providerName === providers[providers.length - 1]) {
        // Last provider also failed
        throw error;
      }
    }
  }

  throw new Error('All providers failed');
}
```

---

## Migration Guide

### Before (Direct Provider Usage)

```typescript
import { getProvider } from './core/api_client';
import { assembleDeltaStream } from './core/stream_assembler';

const provider = getProvider('openai');
const stream = await provider.getChatCompletion(messages, {
  model: 'gpt-4',
  tools: tools,
  tool_choice: 'auto'
});

process.stdout.write('Response: ');
const { content, toolCallsRaw } = await assembleDeltaStream(
  stream,
  (chunk) => process.stdout.write(chunk)
);
process.stdout.write('\n');

// Handle tool calls...
if (toolCallsRaw.length > 0) {
  // ...
}
```

### After (Provider Wrapper)

```typescript
import { getProviderWrapper } from './core/api_client';

const wrapper = getProviderWrapper('openai');
const response = await wrapper.sendChat(messages, {
  model: 'gpt-4',
  tools: tools,
  tool_choice: 'auto',
  onContent: (chunk) => process.stdout.write(chunk)
});

// Handle tool calls...
if (response.toolCalls.length > 0) {
  // ...
}
```

**Benefits:**
- 3 lines instead of 10+
- No need to import `assembleDeltaStream`
- Consistent `toolCalls` naming
- Clearer intent with `sendChat` vs `getChatCompletion`

---

## Architecture

### Design Pattern: Adapter Pattern

The Provider Wrapper implements the Adapter pattern to provide a unified interface over heterogeneous provider APIs.

```
┌─────────────────────────────────────┐
│         Consumer Code               │
│         (chat.ts, etc.)             │
└────────────┬────────────────────────┘
             │
             │ Depends on
             ▼
┌─────────────────────────────────────┐
│      ProviderWrapper                │
│   (Unified Interface)               │
│                                     │
│  + sendChat(messages, options)      │
└────────┬────────────────────────────┘
         │
         │ Adapts
         ▼
┌──────────────────────────────────────┐
│   Provider Implementations           │
│                                      │
│  - OpenAIProvider                    │
│  - MistralProvider                   │
│  - GeminiProvider                    │
└──────────────────────────────────────┘
```

### Responsibilities

**ProviderWrapper:**
- Validate inputs
- Normalize stream formats
- Assemble responses
- Categorize errors
- Extract metadata

**Stream Assembler:**
- Process delta chunks
- Accumulate content
- Assemble tool calls
- Invoke callbacks

**Provider Implementations:**
- Communicate with specific APIs
- Return streaming responses
- Handle API-specific authentication

### Extension Points

Adding a new provider requires:

1. **Create provider class** implementing `getChatCompletion()`
2. **Add to api_client.ts** switch statement
3. **Optional**: Add stream normalization in `ProviderWrapper.normalizeStream()` if format differs

No changes needed in consumer code.

---

## Best Practices

### 1. Use the Wrapper for New Code

```typescript
// GOOD: Use wrapper
const wrapper = getProviderWrapper('openai');
const response = await wrapper.sendChat(messages, options);

// AVOID: Direct provider usage (legacy)
const provider = getProvider('openai');
const stream = await provider.getChatCompletion(messages, options);
```

### 2. Handle Errors Appropriately

```typescript
// GOOD: Specific error handling
try {
  const response = await wrapper.sendChat(messages, options);
} catch (error) {
  if (isProviderError(error)) {
    logger.error(`Provider ${error.providerName} failed`, error);
    // Handle provider-specific error
  }
  throw error;
}

// AVOID: Generic catch-all
try {
  const response = await wrapper.sendChat(messages, options);
} catch (error) {
  console.log('Error:', error); // Not helpful for debugging
}
```

### 3. Use Real-time Callbacks for UX

```typescript
// GOOD: Show progress to user
const response = await wrapper.sendChat(messages, {
  model: 'gpt-4',
  onContent: (chunk) => {
    updateUI(chunk); // Real-time display
  }
});

// AVOID: No feedback until complete
const response = await wrapper.sendChat(messages, { model: 'gpt-4' });
// User sees nothing until response is fully complete
```

### 4. Validate Tool Calls Before Execution

```typescript
// GOOD: Validate and handle errors
for (const toolCall of response.toolCalls) {
  try {
    const args = JSON.parse(toolCall.function.arguments);
    const result = await executeToolCall(toolCall.function.name, args);
    // ...
  } catch (error) {
    logger.error(`Tool ${toolCall.function.name} failed`, error);
    // Add error message to conversation
  }
}
```

### 5. Reuse Wrapper Instances

```typescript
// GOOD: Create once, use multiple times
const wrapper = getProviderWrapper('openai');
const response1 = await wrapper.sendChat(messages1, options1);
const response2 = await wrapper.sendChat(messages2, options2);

// ACCEPTABLE but wasteful: Create new wrapper each time
const response1 = await getProviderWrapper('openai').sendChat(messages1, options1);
const response2 = await getProviderWrapper('openai').sendChat(messages2, options2);
```

---

## Testing

### Unit Testing with Mocks

```typescript
import { ProviderWrapper } from './core/provider_wrapper';

// Mock the getProvider function
jest.mock('./core/api_client', () => ({
  getProvider: jest.fn(() => ({
    getChatCompletion: jest.fn(async function* () {
      yield {
        choices: [{
          delta: { content: 'Hello' }
        }]
      };
      yield {
        choices: [{
          delta: { content: ' world' }
        }]
      };
    })
  }))
}));

test('sendChat assembles content correctly', async () => {
  const wrapper = new ProviderWrapper('mock');
  const response = await wrapper.sendChat(
    [{ role: 'user', content: 'Hi' }],
    { model: 'test-model' }
  );

  expect(response.content).toBe('Hello world');
});
```

---

## Troubleshooting

### Issue: `ProviderConfigurationError: Failed to initialize provider`

**Cause:** Provider not configured or API key missing

**Solution:**
```bash
# Configure the provider
dalton-cli configure ai set openai api_key YOUR_API_KEY
```

### Issue: `ProviderRequestError: Rate limit exceeded`

**Cause:** Too many requests to provider API

**Solution:**
```typescript
// Implement retry with backoff
const response = await sendWithRetry(wrapper, messages, options, 3);

// Or switch to different provider
const wrapper = getProviderWrapper('alternative-provider');
```

### Issue: Empty `response.content` but no error

**Cause:** Model returned only tool calls, no text content

**Solution:**
```typescript
if (response.content === '' && response.toolCalls.length > 0) {
  // This is normal - model is requesting tool execution
  // Execute tools and send another request
}
```

### Issue: `onContent` callback not called

**Cause:** Provider doesn't support streaming or model returned everything at once

**Solution:**
- Check if provider supports streaming
- Some models return non-streamed responses (especially with tool calls)
- This is normal behavior for certain provider/model combinations

---

## Performance Considerations

### Memory Usage

The wrapper accumulates the entire response in memory. For very long responses:

```typescript
// Monitor memory if generating large responses
const response = await wrapper.sendChat(messages, {
  model: 'gpt-4',
  onContent: (chunk) => {
    // Write to file/database incrementally instead of holding in memory
    fs.appendFileSync('output.txt', chunk);
  }
});
// response.content may be very large
```

### Concurrency

Wrappers can be used concurrently:

```typescript
// Safe: Process multiple requests in parallel
const wrapper = getProviderWrapper('openai');
const responses = await Promise.all([
  wrapper.sendChat(messages1, options),
  wrapper.sendChat(messages2, options),
  wrapper.sendChat(messages3, options),
]);
```

---

## FAQ

**Q: Should I use `getProvider()` or `getProviderWrapper()`?**

A: Use `getProviderWrapper()` for new code. It provides a cleaner, more consistent interface. `getProvider()` is maintained for backward compatibility.

**Q: Can I mix and match providers in the same application?**

A: Yes! Each wrapper instance is independent:
```typescript
const openaiWrapper = getProviderWrapper('openai');
const mistralWrapper = getProviderWrapper('mistral');
```

**Q: What happens if a provider API changes?**

A: Changes are isolated to the provider implementation file and potentially the wrapper's normalization logic. Consumer code remains unchanged.

**Q: How do I add a custom provider?**

A:
1. Create a class with `getChatCompletion()` method
2. Add to the switch in `api_client.ts`
3. Optionally add normalization logic if stream format differs
4. Wrapper handles the rest automatically

**Q: Is the wrapper thread-safe?**

A: In Node.js (single-threaded), yes. Each `sendChat()` call is independent and can run concurrently via async/await.

**Q: Can I access provider-specific features?**

A: Not through the wrapper - it provides a common denominator API. For provider-specific features, use `getProvider()` directly.

---

## Future Enhancements

Planned features (not yet implemented):

- **Request timeout support**: Automatic cancellation after specified duration
- **Middleware system**: Plugin hooks for request/response interception
- **Built-in retry logic**: Automatic retry with exponential backoff
- **Response caching**: Optional caching of identical requests
- **Request cancellation**: AbortSignal support for cancellable requests
- **Streaming modes**: Different strategies for content delivery
- **Metrics collection**: Built-in telemetry for monitoring

---

## See Also

- [Stream Assembler](./stream_assembler.ts) - Delta stream processing
- [API Client](./api_client.ts) - Provider factory functions
- [Tools](./tools.ts) - Available tool definitions
- [Schemas](./schemas.ts) - Type definitions

---

## License

Part of the .daltoncli project. See main project LICENSE for details.
