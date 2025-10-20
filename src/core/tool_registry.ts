import { ToolDefinition } from './schemas';
import { executeCommand } from './shell_executor';
import { list_render_services } from '../tools/render_tools';

export const toolRegistry: { [key: string]: ToolDefinition } = {
  'shell_exec': {
    name: 'shell_exec',
    description: 'Executes a shell command.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The shell command to execute.' },
        timeout: { type: 'number', description: 'Timeout in milliseconds.' },
        safeMode: { type: 'boolean', description: 'Whether to run in safe mode with whitelisted commands.' },
      },
      required: ['command'],
    },
    func: async (args: { command: string, timeout?: number, safeMode?: boolean }) => {
      const result = await executeCommand(args.command, args.timeout, args.safeMode);
      if (result.error) {
        throw result.error;
      }
      return `Stdout:
${result.stdout}
Stderr:
${result.stderr}
Exit Code: ${result.exitCode}`;
    },
  },
  'list_render_services': list_render_services,
  // Add other tools here
};
