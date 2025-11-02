import chalk from 'chalk';
import { getProvider } from '../core/api_client';
import { tools } from '../core/tools';

/**
 * Options for the prompt command
 */
interface PromptOptions {
  provider?: string;
  model?: string;
}

/**
 * Custom error class for prompt command errors
 */
class PromptError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'PromptError';
  }
}

/**
 * Validates prompt message
 * @param message - The message to validate
 * @returns true if valid, false otherwise
 */
const isValidPromptMessage = (message: string | undefined): boolean => {
  // DEFENSIVE: Validate message type and content
  if (typeof message !== 'string' || message.trim().length === 0) {
    return false;
  }

  // DEFENSIVE: Limit message length to prevent abuse
  if (message.length > 100000) {
    return false;
  }

  return true;
};

/**
 * Validates prompt options
 * @param options - The options to validate
 * @returns true if valid, false otherwise
 */
const isValidPromptOptions = (options: PromptOptions): boolean => {
  // DEFENSIVE: Validate options is an object
  if (!options || typeof options !== 'object') {
    return false;
  }

  // DEFENSIVE: Validate provider if specified
  if (options.provider !== undefined) {
    if (typeof options.provider !== 'string' || options.provider.trim().length === 0) {
      return false;
    }
  }

  // DEFENSIVE: Validate model if specified
  if (options.model !== undefined) {
    if (typeof options.model !== 'string' || options.model.trim().length === 0) {
      return false;
    }
  }

  return true;
};

/**
 * Sends a single prompt to an AI provider and streams the response
 * Note: This command does not currently handle tool calls
 * @param message - The message/prompt to send
 * @param options - Options including provider and model selection
 */
const handlePrompt = async (message: string, options: PromptOptions): Promise<void> => {
  console.log('handlePrompt received options:', options);
  // DEFENSIVE: Validate message parameter
  if (!isValidPromptMessage(message)) {
    console.error(chalk.red('Error: Invalid or empty prompt message'));
    process.exit(1);
  }

  // DEFENSIVE: Validate options parameter
  if (!isValidPromptOptions(options)) {
    console.error(chalk.red('Error: Invalid prompt options'));
    process.exit(1);
  }

  try {
    const providerName: string = options.provider || 'openai';
    console.log('Resolved providerName:', providerName);

    // DEFENSIVE: Get provider with error handling
    let provider;
    try {
      provider = getProvider(providerName);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new PromptError(`Failed to get provider '${providerName}': ${errorMsg}`, error instanceof Error ? error : undefined);
    }

    // DEFENSIVE: Validate provider instance
    if (!provider || typeof provider.getChatCompletion !== 'function') {
      throw new PromptError(`Provider '${providerName}' is invalid or not configured`);
    }

    const messages = [{ role: 'user' as const, content: message }];
    const modelToUse = options.model || 'gpt-3.5-turbo';
    console.log('Resolved modelToUse:', modelToUse);

    // DEFENSIVE: Get chat completion with error handling
    let stream;
    try {
      stream = await provider.getChatCompletion(messages, {
        model: modelToUse,
        tools: tools,
        tool_choice: 'auto',
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new PromptError(`Failed to get chat completion: ${errorMsg}`, error instanceof Error ? error : undefined);
    }

    // DEFENSIVE: Validate stream
    if (!stream || typeof stream[Symbol.asyncIterator] !== 'function') {
      throw new PromptError('Invalid stream received from provider');
    }

    let fullResponse: string = '';
    console.log(chalk.cyan('Shekinah:'));

    // DEFENSIVE: Stream chunks with error handling
    try {
      for await (const chunk of stream) {
        // DEFENSIVE: Validate chunk structure
        const typedChunk = chunk as { choices?: Array<{ delta?: { content?: string } }> };
        if (!typedChunk || !typedChunk.choices || !Array.isArray(typedChunk.choices)) {
          console.warn(chalk.yellow('Warning: Invalid chunk structure received'));
          continue;
        }

        const content = typedChunk.choices[0]?.delta?.content;
        if (typeof content === 'string') {
          fullResponse += content;
          process.stdout.write(chalk.cyan(content));
        }
      }
      process.stdout.write('\n');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      throw new PromptError(`Error processing stream: ${errorMsg}`, error instanceof Error ? error : undefined);
    }

    // DEFENSIVE: Validate response was received
    if (fullResponse.trim().length === 0) {
      console.warn(chalk.yellow('Warning: Empty response received from provider'));
    }

  } catch (error) {
    if (error instanceof PromptError) {
      console.error(chalk.red(`Prompt error: ${error.message}`));
      if (error.cause) {
        console.error(chalk.gray(`Caused by: ${error.cause.message}`));
      }
    } else {
      const errorMessage: string = error instanceof Error ? error.message : 'Unknown error';
      console.error(chalk.red(`Failed to get a response: ${errorMessage}`));
    }
    process.exit(1);
  }
};

export default handlePrompt;