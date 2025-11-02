import { ToolDefinition } from './schemas';
import { executeCommand, executeCommandWithRetry, CommandRetryOptions } from './shell_executor';
import { list_render_services } from '../tools/render_tools';

/**
 * Global tool registry mapping tool names to their definitions
 * Each tool includes metadata, parameter schema, and implementation
 */
export const toolRegistry: { [key: string]: ToolDefinition } = {
  'shell_exec': {
    name: 'shell_exec',
    description: 'Executes a shell command with optional retry logic.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute.' },
        timeout: { type: 'number', description: 'Timeout in milliseconds.' },
        safeMode: { type: 'boolean', description: 'Whether to run in safe mode with whitelisted commands.' },
        retry: {
          type: 'object',
          description: 'Optional retry configuration for handling transient failures.',
          properties: {
            maxAttempts: { type: 'number', description: 'Maximum number of retry attempts (1-10).' },
            delayMs: { type: 'number', description: 'Initial delay before first retry in milliseconds (0-60000).' },
            continueOnFailure: { type: 'boolean', description: 'Continue execution even if all retries fail.' },
          },
        },
      },
      required: ['command'],
    },
    func: async (...args: unknown[]) => {
      const params = args[0] as {
        command: string;
        timeout?: number;
        safeMode?: boolean;
        retry?: CommandRetryOptions;
      };

      // Use retry logic if retry options are provided
      const result = params.retry
        ? await executeCommandWithRetry(params.command, params.timeout, params.safeMode, params.retry)
        : await executeCommand(params.command, params.timeout, params.safeMode);

      if (result.error && !(params.retry?.continueOnFailure)) {
        throw result.error;
      }
      return `Stdout:\n${result.stdout}\nStderr:\n${result.stderr}\nExit Code: ${result.exitCode}`;
    },
  },
  'list_render_services': list_render_services,
};
