/**
 * Provider Wrapper Usage Examples
 *
 * This file demonstrates common usage patterns for the unified provider wrapper API.
 * These examples show how to migrate from direct provider usage to the wrapper.
 */

import { getProviderWrapper, getProvider } from '../src/core/api_client';
import { assembleDeltaStream } from '../src/core/stream_assembler';
import { tools } from '../src/core/tools';
import { ChatMessage } from '../src/core/schemas';
import { isProviderError, isRetryableError } from '../src/core/provider_wrapper';

// ============================================================================
// Example 1: Basic Usage - Before and After
// ============================================================================

/**
 * BEFORE: Using direct provider access (legacy approach)
 */
async function basicChatOldWay() {
  console.log('=== Example 1a: Basic Chat (Old Way) ===\n');

  const provider = getProvider('openai');
  const messages: ChatMessage[] = [
    { role: 'user', content: 'What is TypeScript?' }
  ];

  const stream = await provider.getChatCompletion(messages, {
    model: 'gpt-4',
    tools: undefined,
    tool_choice: 'auto'
  });

  process.stdout.write('Response: ');
  const { content } = await assembleDeltaStream(
    stream,
    (chunk) => process.stdout.write(chunk)
  );
  process.stdout.write('\n\n');

  console.log('Complete response:', content);
}

/**
 * AFTER: Using provider wrapper (recommended approach)
 */
async function basicChatNewWay() {
  console.log('=== Example 1b: Basic Chat (New Way) ===\n');

  const wrapper = getProviderWrapper('openai');
  const messages: ChatMessage[] = [
    { role: 'user', content: 'What is TypeScript?' }
  ];

  process.stdout.write('Response: ');
  const response = await wrapper.sendChat(messages, {
    model: 'gpt-4',
    onContent: (chunk) => process.stdout.write(chunk)
  });
  process.stdout.write('\n\n');

  console.log('Complete response:', response.content);
}

// ============================================================================
// Example 2: Multi-turn Conversation
// ============================================================================

async function multiTurnConversation() {
  console.log('=== Example 2: Multi-turn Conversation ===\n');

  const wrapper = getProviderWrapper('openai');
  const history: ChatMessage[] = [
    { role: 'system', content: 'You are a helpful programming assistant.' }
  ];

  // Helper function for conversation
  async function chat(userMessage: string): Promise<string> {
    console.log(`User: ${userMessage}`);
    history.push({ role: 'user', content: userMessage });

    process.stdout.write('Assistant: ');
    const response = await wrapper.sendChat(history, {
      model: 'gpt-4',
      onContent: (chunk) => process.stdout.write(chunk)
    });
    process.stdout.write('\n\n');

    history.push({ role: 'assistant', content: response.content });
    return response.content;
  }

  // Have a conversation
  await chat('What is Node.js?');
  await chat('How does it differ from traditional web servers?');
  await chat('Give me a simple example.');
}

// ============================================================================
// Example 3: Tool Calling with Provider Wrapper
// ============================================================================

async function toolCallingExample() {
  console.log('=== Example 3: Tool Calling ===\n');

  const wrapper = getProviderWrapper('openai');
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are a helpful assistant with access to tools.' },
    { role: 'user', content: 'What files are in the current directory?' }
  ];

  const response = await wrapper.sendChat(messages, {
    model: 'gpt-4',
    tools: tools,
    tool_choice: 'auto',
    onContent: (chunk) => process.stdout.write(chunk)
  });

  console.log('\n');

  // Check if model requested tool calls
  if (response.toolCalls.length > 0) {
    console.log('Model requested tool calls:');
    response.toolCalls.forEach(tc => {
      console.log(`  - ${tc.function.name}`);
      console.log(`    Arguments: ${tc.function.arguments}`);
      console.log(`    ID: ${tc.id}`);
    });
  } else {
    console.log('No tool calls requested');
    console.log('Response:', response.content);
  }
}

// ============================================================================
// Example 4: Error Handling
// ============================================================================

async function errorHandlingExample() {
  console.log('=== Example 4: Error Handling ===\n');

  const wrapper = getProviderWrapper('openai');
  const messages: ChatMessage[] = [
    { role: 'user', content: 'Hello!' }
  ];

  try {
    const response = await wrapper.sendChat(messages, {
      model: 'gpt-4'
    });
    console.log('Success:', response.content);
  } catch (error) {
    if (isProviderError(error)) {
      console.error(`Provider ${error.providerName} failed`);
      console.error(`Message: ${error.message}`);
      console.error(`Retryable: ${error.isRetryable}`);

      if (error.originalError) {
        console.error('Original error:', error.originalError.message);
      }

      if (isRetryableError(error)) {
        console.log('This error is retryable - you could implement retry logic here');
      }
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// ============================================================================
// Example 5: Retry Logic
// ============================================================================

async function retryExample() {
  console.log('=== Example 5: Automatic Retry ===\n');

  const wrapper = getProviderWrapper('openai');

  async function sendWithRetry(
    messages: ChatMessage[],
    options: any,
    maxRetries: number = 3
  ) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await wrapper.sendChat(messages, options);
      } catch (error) {
        if (!isRetryableError(error) || attempt === maxRetries - 1) {
          throw error;
        }

        const delay = Math.pow(2, attempt) * 1000;
        console.log(`Attempt ${attempt + 1} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  const messages: ChatMessage[] = [
    { role: 'user', content: 'Hello!' }
  ];

  try {
    const response = await sendWithRetry(messages, { model: 'gpt-4' }, 3);
    console.log('Success:', response.content);
  } catch (error) {
    console.error('All retries failed:', error);
  }
}

// ============================================================================
// Example 6: Provider Comparison
// ============================================================================

async function providerComparisonExample() {
  console.log('=== Example 6: Provider Comparison ===\n');

  const providers = ['openai', 'mistral', 'gemini'];
  const messages: ChatMessage[] = [
    { role: 'user', content: 'What is 2 + 2?' }
  ];

  for (const providerName of providers) {
    try {
      console.log(`\nTrying ${providerName}...`);
      const wrapper = getProviderWrapper(providerName);

      const response = await wrapper.sendChat(messages, {
        model: 'default', // Each provider would need appropriate model
        onContent: (chunk) => process.stdout.write(chunk)
      });
      console.log(`\n${providerName} completed successfully`);

    } catch (error) {
      console.error(`${providerName} failed:`, error instanceof Error ? error.message : error);
    }
  }
}

// ============================================================================
// Example 7: Streaming vs Non-streaming
// ============================================================================

async function streamingComparisonExample() {
  console.log('=== Example 7: Streaming vs Non-streaming ===\n');

  const wrapper = getProviderWrapper('openai');
  const messages: ChatMessage[] = [
    { role: 'user', content: 'Write a haiku about coding.' }
  ];

  // With streaming (shows content as it arrives)
  console.log('WITH STREAMING:');
  const start1 = Date.now();
  const response1 = await wrapper.sendChat(messages, {
    model: 'gpt-4',
    onContent: (chunk) => process.stdout.write(chunk)
  });
  const duration1 = Date.now() - start1;
  console.log(`\nCompleted in ${duration1}ms\n`);

  // Without streaming (all at once)
  console.log('WITHOUT STREAMING:');
  const start2 = Date.now();
  const response2 = await wrapper.sendChat(messages, {
    model: 'gpt-4'
    // No onContent callback
  });
  const duration2 = Date.now() - start2;
  console.log(response2.content);
  console.log(`Completed in ${duration2}ms\n`);

  console.log('Note: Time to first token is faster with streaming,');
  console.log('but total time is similar. Streaming improves UX.');
}

// ============================================================================
// Example 8: Complete Tool Execution Loop
// ============================================================================

async function completeToolExecutionExample() {
  console.log('=== Example 8: Complete Tool Execution Loop ===\n');

  const wrapper = getProviderWrapper('openai');
  const messages: ChatMessage[] = [
    { role: 'system', content: 'You are a helpful assistant with file system access.' },
    { role: 'user', content: 'List the files in the current directory and read package.json' }
  ];

  let iteration = 0;
  const maxIterations = 5;

  while (iteration < maxIterations) {
    iteration++;
    console.log(`\n--- Iteration ${iteration} ---`);

    const response = await wrapper.sendChat(messages, {
      model: 'gpt-4',
      tools: tools,
      tool_choice: 'auto',
      onContent: (chunk) => process.stdout.write(chunk)
    });

    console.log('\n');

    if (response.toolCalls.length === 0) {
      // No tool calls, we're done
      console.log('Final response:', response.content);
      break;
    }

    // Add assistant message with tool calls
    messages.push({
      role: 'assistant',
      tool_calls: response.toolCalls
    });

    // Execute each tool call
    for (const toolCall of response.toolCalls) {
      console.log(`Executing tool: ${toolCall.function.name}`);

      try {
        // Parse arguments
        const args = JSON.parse(toolCall.function.arguments);

        // Execute tool (simplified - in real code, use proper tool execution)
        const result = await executeToolCall(toolCall.function.name, args);

        // Add tool result to messages
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: result
        });

        console.log(`Tool result: ${result.substring(0, 100)}...`);
      } catch (error) {
        console.error(`Tool execution failed:`, error);

        // Add error as tool result
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          name: toolCall.function.name,
          content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }
  }

  if (iteration >= maxIterations) {
    console.log('\nMax iterations reached');
  }
}

/**
 * Mock tool execution function
 * In real code, this would call actual tool implementations
 */
async function executeToolCall(toolName: string, args: any): Promise<string> {
  // Simplified mock implementation
  switch (toolName) {
    case 'execute_shell_command':
      return 'file1.txt\nfile2.js\npackage.json';
    case 'read_file_content':
      return JSON.stringify({ name: 'my-app', version: '1.0.0' }, null, 2);
    default:
      return `Tool ${toolName} not implemented`;
  }
}

// ============================================================================
// Main Runner
// ============================================================================

async function main() {
  console.log('Provider Wrapper Examples\n');
  console.log('='.repeat(60));
  console.log('\n');

  try {
    // Run examples (comment out any you don't want to run)
    await basicChatNewWay();
    // await multiTurnConversation();
    // await toolCallingExample();
    // await errorHandlingExample();
    // await retryExample();
    // await providerComparisonExample();
    // await streamingComparisonExample();
    // await completeToolExecutionExample();

  } catch (error) {
    console.error('Example failed:', error);
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  main().catch(console.error);
}

// Export examples for use in tests or documentation
export {
  basicChatOldWay,
  basicChatNewWay,
  multiTurnConversation,
  toolCallingExample,
  errorHandlingExample,
  retryExample,
  providerComparisonExample,
  streamingComparisonExample,
  completeToolExecutionExample
};
