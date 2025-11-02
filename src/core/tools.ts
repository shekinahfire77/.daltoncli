import { z } from 'zod';
import { toolDefinitionSchema, ToolDefinitionSchema } from './schemas';

/**
 * Type definition for tools validated against the schema
 */
export type Tool = z.infer<typeof toolDefinitionSchema>;

/**
 * Array of available tools for AI agents to use
 * Includes shell execution, file reading, and Render platform integration
 * All tools are validated against the toolDefinitionSchema
 */
export const tools: Tool[] = [
  {
    type: 'function',
    function: {
      name: 'execute_shell_command',
      description: "Executes a shell command in the user's local environment.",
      parameters: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to execute.',
          },
        },
        required: ['command'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'read_file_content',
      description: 'Reads the content of a file from the local filesystem within the project directory.',
      parameters: {
        type: 'object',
        properties: {
          file_path: {
            type: 'string',
            description: 'The relative path to the file within the project directory.',
          },
        },
        required: ['file_path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_render_services',
      description: 'Lists all services for the user on the Render platform.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
];

toolDefinitionSchema.array().parse(tools);
