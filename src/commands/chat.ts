import inquirer from 'inquirer';
import chalk from 'chalk';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { getAvailableModels } from '../core/model_registry';
import { getProvider, AIProvider, ChatCompletionResult } from '../core/api_client'; // Import ChatCompletionResult
import { metaprompt } from '../core/system_prompt';

import { aiProviders } from '../config';
import { handleFs, isPathSafe } from './fs';
import handleShell from './shell';
import { tools, Tool } from '../core/tools';
import { assembleDeltaStream } from '../core/stream_assembler';
import { getChatLimits } from '../core/app_limits';
import { CHAT_CONSTANTS } from '../core/Constants';
import { SessionManager } from '../utils/SessionManager';

// --- Markdown Formatting ---

/**
 * Syntax highlighting map for common keywords by language
 */
const keywordPatterns: Record<string, { keywords: string[]; color: 'cyan' | 'yellow' | 'green' | 'blue' | 'magenta' }> = {
  javascript: {
    keywords: ['function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'import', 'export', 'default', 'async', 'await', 'new', 'class', 'extends', 'static', 'this', 'null', 'undefined', 'true', 'false', 'try', 'catch', 'finally', 'throw'],
    color: 'cyan'
  },
  typescript: {
    keywords: ['function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'import', 'export', 'default', 'async', 'await', 'new', 'class', 'extends', 'static', 'this', 'interface', 'type', 'enum', 'namespace', 'module', 'declare', 'public', 'private', 'protected', 'readonly', 'abstract', 'null', 'undefined', 'true', 'false', 'try', 'catch', 'finally', 'throw'],
    color: 'cyan'
  },
  python: {
    keywords: ['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'as', 'class', 'try', 'except', 'finally', 'with', 'async', 'await', 'lambda', 'pass', 'break', 'continue', 'yield', 'raise', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is'],
    color: 'yellow'
  },
  bash: {
    keywords: ['if', 'then', 'else', 'elif', 'fi', 'for', 'in', 'do', 'done', 'while', 'case', 'esac', 'function', 'return', 'export', 'declare', 'local', 'readonly'],
    color: 'green'
  },
  sql: {
    keywords: ['SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'DROP', 'ALTER', 'TABLE', 'INDEX', 'JOIN', 'INNER', 'LEFT', 'RIGHT', 'ON', 'AND', 'OR', 'NOT', 'NULL', 'GROUP', 'BY', 'ORDER', 'HAVING', 'LIMIT', 'OFFSET', 'AS', 'DISTINCT'],
    color: 'magenta'
  },
  json: {
    keywords: ['true', 'false', 'null'],
    color: 'blue'
  }
};

/**
 * Applies basic syntax highlighting to code based on language
 * @param code - The code string to highlight
 * @param language - The language identifier
 * @returns Highlighted code string with chalk colors
 */
const highlightCode = (code: string, language: string): string => {
  const pattern = keywordPatterns[language.toLowerCase()] || keywordPatterns['javascript'];

  // Create regex for keywords (word boundaries)
  const keywordRegex = new RegExp(`\\b(${pattern.keywords.join('|')})\\b`, 'g');

  return code.replace(keywordRegex, (match) => {
    const colorFn = chalk[pattern.color];
    return colorFn(match);
  });
};

/**
 * Formats markdown text with code block formatting and syntax highlighting
 * @param text - The markdown text to format
 * @returns Formatted text with colored code blocks and inline code
 */
const formatMarkdown = (text: string): string => {
  const lines: string[] = [];
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const inlineCodeRegex = /`([^`]+)`/g;

  let lastIndex = 0;
  let match;

  // Process code blocks
  const codeBlockRegex2 = /```(\w*)\n([\s\S]*?)```/g;
  while ((match = codeBlockRegex2.exec(text)) !== null) {
    const beforeCode = text.substring(lastIndex, match.index);
    const language = match[1] || 'plaintext';
    const code = match[2];

    // Process inline code in text before the code block
    const processedBefore = beforeCode.replace(inlineCodeRegex, (m, p1) => chalk.inverse(p1));
    lines.push(processedBefore);

    // Format code block with border
    const highlightedCode = highlightCode(code, language);
    const codeLines = highlightedCode.split('\n').filter(l => l.length > 0);

    // Build the code block with borders
    const maxWidth = Math.max(...codeLines.map(l => stripAnsiCodes(l).length), language.length + 4);
    const topBorder = chalk.gray('┌─' + '─'.repeat(maxWidth) + '┐');
    const languageLabel = chalk.gray.bold('│ ' + language + ' '.repeat(maxWidth - language.length) + '│');
    const separator = chalk.gray('├─' + '─'.repeat(maxWidth) + '┤');
    const codeContent = codeLines.map(line => {
      const padding = maxWidth - stripAnsiCodes(line).length;
      return chalk.gray('│ ') + line + ' '.repeat(Math.max(0, padding)) + chalk.gray(' │');
    });
    const bottomBorder = chalk.gray('└─' + '─'.repeat(maxWidth) + '┘');

    lines.push(topBorder);
    lines.push(languageLabel);
    lines.push(separator);
    lines.push(...codeContent);
    lines.push(bottomBorder);
    lines.push('');

    lastIndex = match.index + match[0].length;
  }

  // Process remaining text after last code block
  const remainingText = text.substring(lastIndex);
  const processedRemaining = remainingText.replace(inlineCodeRegex, (m, p1) => chalk.inverse(p1));
  lines.push(processedRemaining);

  return lines.join('\n');
};

/**
 * Removes ANSI color codes from a string to get true length
 * @param str - String potentially containing ANSI codes
 * @returns String with ANSI codes removed
 */
const stripAnsiCodes = (str: string): string => {
  return str.replace(/\x1B\[\d+m/g, '');
};

// --- Streaming & Visual Feedback ---

/**
 * Shows a thinking indicator with animated dots
 * @returns Interval ID for the animation
 */
const showThinkingIndicator = (): NodeJS.Timeout => {
  const dots = ['.', '..', '...'];
  let dotIndex = 0;

  const printDot = () => {
    process.stdout.write('\r' + chalk.dim.magenta(`Shekinah is thinking${dots[dotIndex % dots.length]}`));
    dotIndex++;
  };

  printDot();
  return setInterval(printDot, 500);
};

/**
 * Clears the thinking indicator line
 */
const clearThinkingIndicator = (): void => {
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
};

/**
 * Shows a streaming cursor indicator
 */
const getStreamingIndicator = (frame: number): string => {
  const indicators = ['│', '/', '─', '\\'];
  return chalk.dim.cyan(indicators[frame % indicators.length]);
};

/**
 * Shows completion indicator with timestamp for long responses
 * @param duration - Duration of streaming in milliseconds
 */
const showCompletionIndicator = (duration: number): void => {
  const indicator = chalk.green('✓');
  let timeStr = '';

  if (duration > 2000) {
    const seconds = (duration / 1000).toFixed(1);
    timeStr = ` ${chalk.dim(`(${seconds}s)`)}`;
  }

  process.stdout.write(indicator + timeStr);
};

// Type definitions
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  index?: number;
  function: {
    name: string;
    arguments: string;
  };
}

interface ToolResult {
  tool_call_id: string;
  role: 'tool';
  name: string;
  content: string;
}

interface DeltaChunk {
  choices: Array<{
    delta?: {
      content?: string;
      tool_calls?: ToolCallDelta[];
    };
  }>;
}

interface ToolCallDelta {
  index: number;
  id?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface ChatOptions {
  resume?: boolean | string;
  load?: string;
  file?: string;
  provider?: string;
  model?: string;
  save?: string;
  listSessions?: boolean;
  maxHistory?: number;
  deleteSession?: string;
  nonInteractive?: boolean;
}


// Session manager instance
const sessionManager = new SessionManager();

// --- Error Handling & User Guidance ---

/**
 * Formats error messages with category and actionable suggestions
 * @param category - Error category (e.g., "CONNECTION ERROR", "AUTHENTICATION ERROR")
 * @param message - The error message
 * @param suggestion - Actionable suggestion for the user
 * @returns Formatted error string
 */
const formatError = (category: string, message: string, suggestion: string): string => {
  const header = chalk.bold.red(`❌ ${category}`);
  const msg = chalk.red(`   ${message}`);
  const hint = chalk.yellow(`   💡 Suggestion: ${suggestion}`);
  return `${header}\n${msg}\n${hint}`;
};

/**
 * Shows helpful tips for first-time users
 */
const showHelpHints = (): void => {
  console.log('\n' + chalk.bold.cyan('Quick Tips:'));
  console.log(chalk.cyan('  • Type "exit" or "quit" to end the session'));
  console.log(chalk.cyan('  • Press Ctrl+C to interrupt at any time'));
  console.log(chalk.cyan('  • Your session is automatically saved'));
  console.log(chalk.cyan('  • Use --help to see all available options'));
  console.log('');
};

/**
 * Lists available tools for user reference
 */
const showAvailableTools = (): void => {
  console.log('\n' + chalk.bold.cyan('Available Tools:'));
  tools.forEach(tool => {
    console.log(chalk.cyan(`  • ${tool.function.name}`));
    console.log(chalk.dim(`    ${tool.function.description}`));
  });
  console.log('');
};


/**
 * Categorizes filesystem errors and provides helpful guidance
 * @param error - The error to categorize
 * @returns Category and suggestion string
 */
const categorizeError = (error: any): { category: string; suggestion: string } => {
  const errCode = (error as NodeJS.ErrnoException)?.code;

  if (errCode === 'EACCES') {
    return {
      category: 'PERMISSION DENIED',
      suggestion: 'Check file permissions or run with appropriate access rights.'
    };
  }

  if (errCode === 'ENOENT') {
    return {
      category: 'FILE NOT FOUND',
      suggestion: 'Verify the session exists using --list-sessions.'
    };
  }

  if (errCode === 'ENOSPC') {
    return {
      category: 'DISK SPACE FULL',
      suggestion: 'Free up disk space and try again.'
    };
  }

  return {
    category: 'UNKNOWN ERROR',
    suggestion: 'Check your configuration and try again.'
  };
};


// --- Core Logic ---


// ... existing code ...

/**
 * Gets the list of configured AI providers
 * @returns Array of provider names
 */
const getConfiguredProviders = (): string[] => {
  return Object.keys(aiProviders).filter(providerName => aiProviders[providerName].enabled);
};

/**
 * Executes a tool call requested by the AI
 * @param toolCall - The tool call to execute
 * @param nonInteractive - Whether to auto-approve tool execution without prompting
 * @returns The tool result
 */
const executeToolCall = async (toolCall: ToolCall, nonInteractive: boolean = false): Promise<ToolResult> => {
  // DEFENSIVE: Validate tool call structure
  if (!toolCall || !toolCall.id || !toolCall.function || !toolCall.function.name) {
    console.error(formatError(
      'INVALID TOOL CALL',
      'Tool call structure is malformed or missing required fields',
      'Verify that the AI provider is functioning correctly.'
    ));
    return {
      tool_call_id: toolCall?.id || 'unknown',
      role: 'tool',
      name: 'error',
      content: 'Invalid tool call structure received',
    };
  }

  const { name, arguments: argsStr } = toolCall.function;
  let args: Record<string, any>;

  // DEFENSIVE: Parse tool arguments with error handling
  try {
    if (typeof argsStr !== 'string') {
      throw new Error('Tool arguments must be a JSON string');
    }
    args = JSON.parse(argsStr);
    if (typeof args !== 'object' || args === null) {
      throw new Error('Tool arguments must parse to an object');
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(formatError(
      'TOOL ARGUMENT ERROR',
      `Failed to parse arguments for tool '${name}': ${errorMessage}`,
      'Check the tool arguments format or try again.'
    ));
    return {
      tool_call_id: toolCall.id,
      role: 'tool',
      name,
      content: `Error parsing arguments: ${errorMessage}`,
    };
  }

  // Display tool call with visual hierarchy
  console.log('\n' + chalk.yellow('─'.repeat(60)));
  console.log(chalk.yellow.bold('🔧 TOOL CALL'));
  console.log(chalk.yellow(`Tool: ${chalk.bold(name)}`));
  console.log(chalk.yellow('Arguments:'));
  console.log(chalk.gray(JSON.stringify(args, null, 2)));
  console.log(chalk.yellow('─'.repeat(60)));

  // Handle tool execution confirmation
  if (nonInteractive) {
    console.log(chalk.yellow(`[Non-Interactive] Auto-executing: ${name}`));
  } else {
    try {
      const { confirmExecution } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmExecution',
          message: `Execute tool '${name}'?`,
          default: true,
        },
      ]);

      if (!confirmExecution) {
        return {
          tool_call_id: toolCall.id,
          role: 'tool',
          name,
          content: 'Tool execution declined by user',
        };
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(formatError(
        'CONFIRMATION ERROR',
        `Failed to get confirmation: ${errorMsg}`,
        'Tool execution cancelled.'
      ));
      return {
        tool_call_id: toolCall.id,
        role: 'tool',
        name,
        content: 'Tool execution cancelled due to confirmation error',
      };
    }
  }

  let result: string;
  try {
    // DEFENSIVE: Validate and execute tool based on name
    if (name === 'execute_shell_command') {
      // DEFENSIVE: Validate command argument exists
      if (typeof args.command !== 'string') {
        result = formatError(
          'INVALID SHELL COMMAND',
          'Command argument must be a string',
          'Ensure the command is properly formatted.'
        );
      } else {
        const shellResult = await handleShell(args.command, true, nonInteractive);
        result = typeof shellResult === 'string' ? shellResult : await shellResult;
      }
    } else if (name === 'read_file_content') {
      // DEFENSIVE: Validate file path argument exists
      if (typeof args.file_path !== 'string') {
        result = formatError(
          'INVALID FILE PATH',
          'File path argument must be a string',
          'Ensure the file path is properly specified.'
        );
      } else {
        const fsResult = await handleFs('read', [args.file_path], true);
        result = typeof fsResult === 'string' ? fsResult : await fsResult;
      }
    } else if (name === 'list_render_services') {
      result = await listRenderServices();
    } else {
      // Unknown tool - provide helpful guidance
      result = formatError(
        'UNKNOWN TOOL',
        `Tool '${name}' is not recognized`,
        `Available tools: ${tools.map(t => t.function.name).join(', ')}`
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(formatError(
      'TOOL EXECUTION ERROR',
      `Failed to execute tool '${name}': ${errorMessage}`,
      'Check the tool arguments and try again, or contact support if the problem persists.'
    ));
    result = `Error executing tool: ${errorMessage}`;
  }

  return {
    tool_call_id: toolCall.id,
    role: 'tool',
    name,
    content: String(result),
  };
};

/**
 * Placeholder for listing Render services
 * @returns Status message
 */
const listRenderServices = async (): Promise<string> => {
  // Placeholder implementation
  return 'Render services feature not yet implemented.';
};

/**
 * Main chat loop - handles interaction with the AI provider
 * @param provider - The AI provider instance
 * @param model - The model to use
 * @param initialHistory - Initial chat history
 * @param sessionName - Optional session name for saving
 * @param maxHistory - Maximum number of messages to keep in context
 * @param nonInteractive - Whether to auto-approve tool execution without prompting
 */
const chatLoop = async (
  provider: AIProvider,
  model: string,
  initialHistory: ChatMessage[],
  sessionName?: string,
  maxHistory?: number,
  nonInteractive?: boolean
): Promise<void> => {
  const chatLimits = getChatLimits();
  const effectiveMaxHistory = maxHistory ?? chatLimits.historyLimit;

  // Initialize total token counters
  let totalInputTokens = 0;
  let totalOutputTokens = 0;


  // DEFENSIVE: Validate input parameters
  if (!provider || typeof provider.getChatCompletion !== 'function') {
    throw new Error(formatError(
      'PROVIDER ERROR',
      'Invalid AI provider: must have getChatCompletion method',
      'Check your configuration and ensure the provider is correctly set up.'
    ));
  }

  if (typeof model !== 'string' || model.trim().length === 0) {
    throw new Error(formatError(
      'MODEL ERROR',
      'Model must be a non-empty string',
      'Verify you have selected a valid model.'
    ));
  }

  if (!Array.isArray(initialHistory)) {
    throw new Error(formatError(
      'HISTORY ERROR',
      'Initial history must be an array',
      'Check your session configuration.'
    ));
  }

  if (effectiveMaxHistory < chatLimits.maxHistoryLowerBound || effectiveMaxHistory > chatLimits.maxHistoryUpperBound) {
    throw new Error(formatError(
      'HISTORY LIMIT ERROR',
      `Max history must be between ${chatLimits.maxHistoryLowerBound} and ${chatLimits.maxHistoryUpperBound}`,
      `Use --max-history with a value in the valid range.`
    ));
  }

  let sessionHistory: ChatMessage[] = initialHistory;
  console.log(chalk.bold.cyan('\n--- Chat Session Started ---'));
  console.log(chalk.cyan(`Provider: ${provider.providerName} | Model: ${model}`));
  console.log(chalk.dim("Type 'exit' or 'quit' to end. Press Ctrl+C to interrupt."));
  console.log(chalk.bold.cyan('─'.repeat(60)) + '\n');
  showHelpHints();

  const saveAndExit = (): void => {
    const currentSessionName = sessionName || '__last_session';

    try {
      // DEFENSIVE: Check if rotation is needed before final save
      const rotationResult = sessionManager.rotateSessionIfNeeded(
        currentSessionName,
        sessionHistory
      );

      if (rotationResult.rotated) {
        // DEFENSIVE: Save new session with system prompt only
        try {
          const systemPrompt = sessionHistory[0];
          const saveResult = sessionManager.saveSession(currentSessionName, [
            systemPrompt,
          ]);

          if (saveResult.success) {
            console.log(
              chalk.green(
                `\n✓ New session saved as '${currentSessionName}'. Exiting.`
              )
            );
          } else {
            console.error(chalk.red(`Warning: ${saveResult.message}`));
          }
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
          console.error(
            chalk.red(`Warning: Failed to save rotated session: ${errorMsg}`)
          );
        }
      } else {
        // DEFENSIVE: Save session with error handling
        try {
          const saveResult = sessionManager.saveSession(
            currentSessionName,
            sessionHistory
          );

          if (saveResult.success) {
            console.log(chalk.green(`\n✓ Session saved as '${currentSessionName}'`));
            if (saveResult.details) {
              console.log(chalk.gray(`  Location: ${saveResult.details.location}`));
              console.log(chalk.gray(`  Size: ${saveResult.details.size}`));
              console.log(
                chalk.gray(`  Messages: ${saveResult.details.messageCount}\n`)
              );
            }
          } else {
            console.error(chalk.red(`Warning: ${saveResult.message}`));
          }
          console.log(chalk.cyan('Exiting.'));
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';
          console.error(chalk.red(`Warning: Failed to save session: ${errorMsg}`));
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(chalk.red(`Error during session save: ${errorMsg}`));
    } finally {
      process.exit();
    }
  };

  process.on('SIGINT', saveAndExit);

  while (true) {
    let prompt: string;

    // DEFENSIVE: Handle user input with error handling
    try {
      const response = await inquirer.prompt([
        {
          type: 'input',
          name: 'prompt',
          message: chalk.green('You: '),
        },
      ]);
      prompt = response.prompt;
    } catch (error) {
      // DEFENSIVE: Handle inquirer errors (e.g., Ctrl+C)
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('User force closed') || errorMsg.includes('closed')) {
        console.log(chalk.cyan('\nSession interrupted. Saving and exiting...'));
      } else {
        console.error(formatError(
          'INPUT ERROR',
          `Failed to read user input: ${errorMsg}`,
          'Try again or press Ctrl+C to exit.'
        ));
      }
      saveAndExit();
      break;
    }

    if (['exit', 'quit'].includes(prompt.toLowerCase())) {
      saveAndExit();
      break;
    }

    // DEFENSIVE: Validate user prompt
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      console.log(chalk.dim('(Please enter a valid message)'));
      continue;
    }

    // Display user message with visual formatting
    console.log(chalk.cyan(`\nYou: ${prompt}`));
    sessionHistory.push({ role: 'user', content: prompt });

    try {
      // DEFENSIVE: Enforce maxHistory to prevent memory exhaustion
      const truncatedHistory: ChatMessage[] =
        sessionHistory.length > effectiveMaxHistory + 1
          ? [sessionHistory[0], ...sessionHistory.slice(-effectiveMaxHistory)]
          : sessionHistory;

      // DEFENSIVE: Get completion with error handling
      let chatCompletionResult: ChatCompletionResult;
      let stream: AsyncIterable<DeltaChunk>;
      try {
        const chatCompletionResult: any = await provider.getChatCompletion(truncatedHistory, {
          model,
          tools,
          tool_choice: 'auto',
        });

        if (chatCompletionResult.stream) {
          stream = chatCompletionResult.stream;
          totalInputTokens += chatCompletionResult.tokenUsage.inputTokens;
          totalOutputTokens += chatCompletionResult.tokenUsage.outputTokens;
        } else {
          stream = chatCompletionResult;
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        let category = 'API ERROR';
        let suggestion = 'Check your API key and network connection.';

        if (errorMsg.toLowerCase().includes('api') || errorMsg.toLowerCase().includes('key') || errorMsg.toLowerCase().includes('auth')) {
          category = 'AUTHENTICATION ERROR';
          suggestion = 'Verify your API key is valid and correctly configured.';
        } else if (errorMsg.toLowerCase().includes('timeout') || errorMsg.toLowerCase().includes('network')) {
          category = 'TIMEOUT ERROR';
          suggestion = 'Check your network connection and try again.';
        } else if (errorMsg.toLowerCase().includes('rate')) {
          category = 'RATE LIMIT ERROR';
          suggestion = 'Too many requests. Wait a moment and try again.';
        }

        throw new Error(formatError(category, `Failed to get chat completion: ${errorMsg}`, suggestion));
      }

      // Show thinking indicator before streaming
      const thinkingInterval = showThinkingIndicator();
      const startTime = Date.now();

      // DEFENSIVE: Stream assembly with error handling
      let fullResponse: string;
      let validToolCalls: ToolCall[];
      try {
        clearInterval(thinkingInterval);
        clearThinkingIndicator();
        console.log(chalk.bold.magenta('Shekinah: '));

        let tokenCount = 0;
        const result = await assembleDeltaStream(
          stream,
          (chunk) => {
            process.stdout.write(chalk.magenta(chunk));
            tokenCount++;
          }
        );
        fullResponse = result.content;
        validToolCalls = result.toolCallsRaw;
      } catch (error) {
        clearInterval(thinkingInterval);
        clearThinkingIndicator();
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to assemble stream: ${errorMsg}`);
      }

      const duration = Date.now() - startTime;
      process.stdout.write(' ');
      showCompletionIndicator(duration);
      process.stdout.write('\n\n');

      console.log(chalk.dim('─'.repeat(60)));
      sessionHistory.push({ role: 'assistant', content: fullResponse });

      // Display total token usage after each turn
      console.log(chalk.gray(`Total Tokens (Session): Input: ${totalInputTokens}, Output: ${totalOutputTokens}`));
      if (validToolCalls.length > 0) {
        sessionHistory.pop();
        sessionHistory.push({ role: 'assistant', tool_calls: validToolCalls });

        // DEFENSIVE: Execute tool calls with error handling
        let toolResults: ToolResult[];
        try {
          toolResults = await Promise.all(
            validToolCalls.map((tc: ToolCall) => executeToolCall(tc, nonInteractive || false))
          );
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(chalk.bold.red(`\nX Error executing tool calls: ${errorMsg}`));
          throw error;
        }

        // Display tool results with visual formatting
        for (const result of toolResults) {
          console.log('\n' + chalk.gray('─'.repeat(60)));
          console.log(chalk.gray.bold('Result from: ' + result.name));
          console.log(chalk.gray(result.content));
          console.log(chalk.gray('─'.repeat(60)));
        }

        sessionHistory.push(...toolResults);

        // DEFENSIVE: Apply history truncation for tool call follow-up
        const truncatedHistoryWithTools: ChatMessage[] =
          sessionHistory.length > effectiveMaxHistory + 1
            ? [sessionHistory[0], ...sessionHistory.slice(-effectiveMaxHistory)]
            : sessionHistory;

        // DEFENSIVE: Get final completion with error handling
        let finalChatCompletionResult: ChatCompletionResult;
        let finalStream: AsyncIterable<DeltaChunk>;
        try {
          const finalChatCompletionResult: any = await provider.getChatCompletion(
            truncatedHistoryWithTools,
            { model, tools, tool_choice: 'auto' }
          );

          if (finalChatCompletionResult.stream) {
            finalStream = finalChatCompletionResult.stream;
            totalInputTokens += finalChatCompletionResult.tokenUsage.inputTokens;
            totalOutputTokens += finalChatCompletionResult.tokenUsage.outputTokens;
          } else {
            finalStream = finalChatCompletionResult;
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`Failed to get final chat completion: ${errorMsg}`);
        }

        // Show thinking indicator before streaming
        const finalThinkingInterval = showThinkingIndicator();
        const finalStartTime = Date.now();

        // DEFENSIVE: Stream assembly with error handling
        let finalResponseText: string;
        try {
          clearInterval(finalThinkingInterval);
          clearThinkingIndicator();
          console.log(chalk.bold.magenta('Shekinah (Follow-up): '));

          let finalTokenCount = 0;
          const result = await assembleDeltaStream(
            finalStream,
            (chunk) => {
              process.stdout.write(chalk.magenta(chunk));
              finalTokenCount++;
            }
          );
          finalResponseText = result.content;
        } catch (error) {
          clearInterval(finalThinkingInterval);
          clearThinkingIndicator();
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          throw new Error(`Failed to assemble final stream: ${errorMsg}`);
        }

        const finalDuration = Date.now() - finalStartTime;
        process.stdout.write(' ');
        showCompletionIndicator(finalDuration);
        process.stdout.write('\n\n');

        console.log(chalk.dim('─'.repeat(60)));
        sessionHistory.push({ role: 'assistant', content: finalResponseText });
        // Display total token usage after tool-call follow-up
        console.log(chalk.gray(`Total Tokens (Session): Input: ${totalInputTokens}, Output: ${totalOutputTokens}`));
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'An unknown error occurred';

      // Better error display
      if (!errorMessage.includes('❌')) {
        console.error(formatError(
          'CHAT ERROR',
          errorMessage,
          'Your session has been saved. Try again or contact support if the problem persists.'
        ));
      } else {
        console.error('\n' + errorMessage);
      }
      console.log(chalk.dim('─'.repeat(60)));

      // DEFENSIVE: Add error to history for context recovery
      sessionHistory.push({
        role: 'assistant',
        content: `(System: The previous attempt failed with an error: ${errorMessage})`,
      });
    }
  }
};

/**
 * Main handler for the chat command
 * @param options - Chat options from CLI
 */
const handleChat = async (options: ChatOptions): Promise<void> => {
  // DEFENSIVE: Validate options object
  if (!options || typeof options !== 'object') {
    console.error(formatError(
      'CONFIGURATION ERROR',
      'Invalid options provided',
      'Check your command line arguments and try again.'
    ));
    return;
  }

  // Handle --list-sessions option
  if (options.listSessions) {
    const result = sessionManager.listSessions();
    if (result.success && result.sessions.length > 0) {
      // Build table
      console.log('');
      console.log(
        chalk.bold.cyan(
          '┌─ Available Sessions ─────────────────────────────────────────────────┐'
        )
      );

      // Table headers
      const headers = ['Name', 'Last Modified', 'Size', 'Messages'];
      const colWidths = [20, 19, 10, 10];
      const headerRow = `│ ${chalk.cyan(
        headers[0].padEnd(colWidths[0])
      )} │ ${chalk.gray(headers[1].padEnd(colWidths[1]))} │ ${chalk.yellow(
        headers[2].padEnd(colWidths[2])
      )} │ ${chalk.magenta(headers[3].padEnd(colWidths[3]))} │`;
      console.log(headerRow);
      console.log(
        chalk.gray(
          '├─' +
            '─'.repeat(colWidths[0]) +
            '─┼─' +
            '─'.repeat(colWidths[1]) +
            '─┼─' +
            '─'.repeat(colWidths[2]) +
            '─┼─' +
            '─'.repeat(colWidths[3]) +
            '─┤'
        )
      );

      // Format size helper
      const formatSize = (bytes: number): string => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return (
          Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i]
        );
      };

      // Table rows
      result.sessions.forEach((session) => {
        const name = session.name
          .substring(0, colWidths[0] - 1)
          .padEnd(colWidths[0]);
        const modified = session.modified
          .toLocaleString()
          .substring(0, colWidths[1] - 1)
          .padEnd(colWidths[1]);
        const size = formatSize(session.size).padEnd(colWidths[2]);
        const msgCount = session.messageCount
          .toString()
          .padEnd(colWidths[3]);

        const errorMarker = session.error ? ' ⚠' : '';
        const row = `│ ${chalk.cyan(name)} │ ${chalk.gray(
          modified
        )} │ ${chalk.yellow(size)} │ ${chalk.magenta(msgCount)} ${errorMarker}│`;
        console.log(row);
      });

      console.log(
        chalk.bold.cyan(
          '└─' +
            '─'.repeat(colWidths[0]) +
            '─┴─' +
            '─'.repeat(colWidths[1]) +
            '─┴─' +
            '─'.repeat(colWidths[2]) +
            '─┴─' +
            '─'.repeat(colWidths[3]) +
            '─┘'
        )
      );
      console.log('');
    } else if (result.sessions.length === 0) {
      console.log(chalk.yellow('\nNo sessions found.\n'));
    } else {
      console.error(
        formatError(
          'LIST SESSIONS ERROR',
          result.message || 'Failed to list sessions',
          'Check your session directory and try again.'
        )
      );
    }
    return;
  }

  // Handle --delete-session option
  if (options.deleteSession) {
    const sessionInfo = sessionManager.getSessionInfo(options.deleteSession);

    if (!sessionInfo) {
      console.error(
        formatError(
          'SESSION NOT FOUND',
          `Session '${options.deleteSession}' does not exist`,
          'Use --list-sessions to see available sessions.'
        )
      );
      return;
    }

    // Format size helper
    const formatSize = (bytes: number): string => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return (
        Math.round((bytes / Math.pow(k, i)) * 10) / 10 + ' ' + sizes[i]
      );
    };

    // Show session info
    console.log('\n' + chalk.yellow('Session to be deleted:'));
    console.log(chalk.cyan(`  Name: ${options.deleteSession}`));
    console.log(chalk.gray(`  Size: ${formatSize(sessionInfo.size)}`));
    console.log(
      chalk.gray(`  Modified: ${sessionInfo.modified.toLocaleString()}`)
    );

    // Request confirmation
    inquirer
      .prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Are you sure you want to delete session '${options.deleteSession}'?`,
          default: false,
        },
      ])
      .then((answer) => {
        if (!answer.confirm) {
          console.log(chalk.cyan('Deletion cancelled.'));
          return;
        }

        // Delete the session (deleteSession is guaranteed to be defined here)
        if (options.deleteSession) {
          const deleteResult = sessionManager.deleteSession(
            options.deleteSession
          );
          if (deleteResult.success) {
            console.log(chalk.green(`✓ ${deleteResult.message}`));
          } else {
            console.error(
              formatError(
                'DELETION FAILED',
                deleteResult.message,
                'Check file permissions and try again.'
              )
            );
          }
        }
      })
      .catch((error) => {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(
          formatError(
            'DELETION ERROR',
            `Error deleting session: ${errorMsg}`,
            'Try again or check file permissions.'
          )
        );
      });
    return;
  }

  // DEFENSIVE: Validate and set maxHistory
  const chatLimits = getChatLimits();
  let maxHistory: number | undefined = undefined;

  if (options.maxHistory !== undefined) {
    if (typeof options.maxHistory !== 'number' ||
        options.maxHistory < chatLimits.maxHistoryLowerBound ||
        options.maxHistory > chatLimits.maxHistoryUpperBound) {
      console.error(formatError(
        'HISTORY LIMIT ERROR',
        `--max-history must be a number between ${chatLimits.maxHistoryLowerBound} and ${chatLimits.maxHistoryUpperBound}.`,
        `Example: --max-history ${chatLimits.historyLimit}`
      ));
      return;
    }
    maxHistory = options.maxHistory;
    console.log(chalk.green(`✓ Using custom history limit: ${maxHistory} messages`));
  }

  let initialHistory: ChatMessage[] | null = null;
  let sessionName: string | undefined = options.save;

  // DEFENSIVE: Load session with error handling
  try {
    if (options.resume) {
      const loadResult = sessionManager.loadSession('__last_session');
      if (loadResult.success && loadResult.data) {
        initialHistory = loadResult.data;
        const messageCount = initialHistory.length;
        const preview = sessionManager.getSessionPreview(initialHistory);

        console.log(chalk.green(`\n✓ Resumed previous session`));
        console.log(chalk.cyan(`  Messages: ${messageCount}`));

        if (preview.first) {
          console.log(chalk.gray(`  First message: ${preview.first}`));
        }
        if (preview.last) {
          console.log(chalk.gray(`  Last message: ${preview.last}`));
        }

        // Confirm if session is large
        const chatLimits = getChatLimits();
        if (messageCount > chatLimits.sessionLoadWarningThreshold) {
          const answer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'proceed',
              message: `This session has ${messageCount} messages. Continue loading?`,
              default: true,
            },
          ]);

          if (!answer.proceed) {
            console.log(chalk.cyan(CHAT_CONSTANTS.SESSION_LOAD_CANCELLED));
            return;
          }
        }
        console.log('');
      }
    } else if (options.load) {
      if (typeof options.load !== 'string' || options.load.trim().length === 0) {
        console.error(
          formatError(
            'SESSION NAME ERROR',
            '--load requires a valid session name',
            'Use --list-sessions to see available sessions.'
          )
        );
        return;
      }

      const loadResult = sessionManager.loadSession(options.load);
      if (loadResult.success && loadResult.data) {
        initialHistory = loadResult.data;
        const messageCount = initialHistory.length;
        const preview = sessionManager.getSessionPreview(initialHistory);

        sessionName = options.load;
        console.log(chalk.green(`\n✓ Loaded session '${options.load}'`));
        console.log(chalk.cyan(`  Messages: ${messageCount}`));

        if (preview.first) {
          console.log(chalk.gray(`  First message: ${preview.first}`));
        }
        if (preview.last) {
          console.log(chalk.gray(`  Last message: ${preview.last}`));
        }

        // Confirm if session is large
        const chatLimits = getChatLimits();
        if (messageCount > chatLimits.sessionLoadWarningThreshold) {
          const answer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'proceed',
              message: `This session has ${messageCount} messages. Continue loading?`,
              default: true,
            },
          ]);

          if (!answer.proceed) {
            console.log(chalk.cyan(CHAT_CONSTANTS.SESSION_LOAD_CANCELLED));
            return;
          }
        }
        console.log('');
      } else {
        console.error(
          formatError(
            'SESSION NOT FOUND',
            `Session '${options.load}' does not exist`,
            'Use --list-sessions to see available sessions or start a new session.'
          )
        );
        return;
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const { category, suggestion } = categorizeError(error);
    console.error(
      formatError(
        category,
        `Failed to load session: ${errorMsg}`,
        suggestion
      )
    );
    return;
  }

  if (!initialHistory) {
    initialHistory = [{ role: 'system', content: metaprompt }];
  }

  // DEFENSIVE: Load file context with validation
  if (options.file) {
    if (typeof options.file !== 'string' || options.file.trim().length === 0) {
      console.error(formatError(
        'FILE PATH ERROR',
        '--file requires a valid file path',
        'Provide a path to a readable file in your project.'
      ));
      return;
    }

    if (!isPathSafe(options.file)) {
      console.error(formatError(
        'SECURITY ERROR',
        'Cannot access file outside of project directory',
        'Provide a file path within your project directory.'
      ));
      return;
    }

    try {
      if (!fs.existsSync(options.file)) {
        console.error(formatError(
          'FILE NOT FOUND',
          `File does not exist: ${options.file}`,
          'Verify the file path and try again.'
        ));
        return;
      }

      const fileContent: string = fs.readFileSync(options.file, 'utf-8');
      initialHistory.push({
        role: 'system',
        content: `File context: ${options.file}\n${fileContent}`,
      });
      console.log(chalk.green(`✓ File loaded: ${options.file}`));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const { category, suggestion } = categorizeError(error);
      console.error(formatError(category, `Failed to read file: ${errorMessage}`, suggestion));
      return;
    }
  }

  // DEFENSIVE: Get configured providers with error handling
  let configuredProviders: string[];
  try {
    configuredProviders = getConfiguredProviders();
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const { category, suggestion } = categorizeError(error);
    console.error(formatError(
      category,
      `Failed to get configured providers: ${errorMsg}`,
      suggestion
    ));
    return;
  }

  if (configuredProviders.length === 0) {
    console.error(formatError(
      'CONFIGURATION ERROR',
      'No AI providers configured',
      'Set up at least one AI provider in your configuration file.'
    ));
    return;
  }

  // DEFENSIVE: Select provider with validation
  let providerName: string | undefined = options.provider;
  if (!providerName) {
    // Only prompt for provider if not already specified in options
    if (configuredProviders.length === 1) {
      providerName = configuredProviders[0];
      console.log(chalk.cyan(`Using provider: ${providerName}`));
    } else {
      try {
        const answer = await inquirer.prompt([
          {
            type: 'list',
            name: 'providerName',
            message: 'Select an AI Provider:',
            choices: configuredProviders,
          },
        ]);
        providerName = answer.providerName as string;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        if (errorMsg.includes('User force closed') || errorMsg.includes('closed')) {
          console.log(chalk.cyan('Provider selection cancelled.'));
        } else {
          console.error(formatError(
            'PROVIDER SELECTION ERROR',
            `Failed to select provider: ${errorMsg}`,
            'Try again with --provider flag to skip selection.'
          ));
        }
        return;
      }
    }
  }

  // DEFENSIVE: Validate provider name
  if (!providerName || typeof providerName !== 'string') {
    console.error(formatError(
      'PROVIDER ERROR',
      'Invalid provider name specified',
      'Use --provider with a valid provider name.'
    ));
    return;
  }

  // DEFENSIVE: Select model with validation
  let model: string | undefined = options.model;
  if (!model) {
    // Only prompt for model if not already specified in options
    try {
      // Check if provider has a deployment_name configured (for Azure)
      const providerConfig = aiProviders[providerName];
      const deploymentName = providerConfig?.deployment_name as string | undefined;

      // Auto-select deployment_name for Azure if configured
      if (deploymentName && deploymentName.trim() && providerName.toLowerCase() === 'azure') {
        model = deploymentName;
        console.log(chalk.cyan(`Using model from Azure deployment: ${model}`));
      } else {
        // Show interactive model selection only if no deployment_name is configured
        const availableModels = getAvailableModels([providerName]);
        if (availableModels.length === 0) {
          console.error(formatError(
            'MODEL CONFIGURATION ERROR',
            `No models available for provider '${providerName}'`,
            'Ensure your API credentials are valid and the provider is configured correctly.'
          ));
          return;
        }

        const { selectedModel } = await inquirer.prompt([
          {
            type: 'list',
            name: 'selectedModel',
            message: `Select a model from ${providerName}:`,
            choices: availableModels.map((m) => ({
              name: m.name.split(': ')[1],
              value: m.value.model,
            })),
          },
        ]);
        model = selectedModel as string;
        console.log(chalk.cyan(`Using model: ${model}`));
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      if (errorMsg.includes('User force closed') || errorMsg.includes('closed')) {
        console.log(chalk.cyan('Model selection cancelled.'));
      } else {
        console.error(formatError(
          'MODEL SELECTION ERROR',
          `Failed to select model: ${errorMsg}`,
          'Try again with --model flag to skip selection.'
        ));
      }
      return;
    }
  }

  // DEFENSIVE: Validate model
  if (!model || typeof model !== 'string') {
    console.error(formatError(
      'MODEL ERROR',
      'Invalid model selection',
      'Specify a valid model with --model flag.'
    ));
    return;
  }

  // DEFENSIVE: Get provider and start chat loop with error handling
  try {
    const provider: AIProvider = getProvider(
      providerName
    ) as unknown as AIProvider;

    if (!provider) {
      throw new Error(`Provider '${providerName}' could not be initialized`);
    }

    console.log(chalk.bold.green('✓ All settings configured. Starting chat session...\n'));
    await chatLoop(provider, model, initialHistory, sessionName, maxHistory, options.nonInteractive);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'An unknown error occurred';

    // Check if error already has formatting
    if (errorMessage.includes('❌')) {
      console.error('\n' + errorMessage);
    } else {
      console.error(formatError(
        'CHAT INITIALIZATION ERROR',
        errorMessage,
        'Check your configuration and try again.'
      ));
    }
  }
};

export default handleChat;
