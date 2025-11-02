import { z } from 'zod';
import { ToolDefinitionSchema, ToolDefinition } from './core/schemas';

/**
 * Example tool definition for reference
 * This demonstrates the structure of tool definitions
 */
const exampleTool: ToolDefinition = {
  name: 'exampleTool',
  description: 'An example tool that does something.',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'A string parameter' },
    },
    required: ['param1'],
  },
  func: (...args: unknown[]) => {
    const param1 = args[0] as string;
    console.log(`Example tool called with: ${param1}`);
    return `Result of exampleTool with ${param1}`;
  },
};

/**
 * Array of validated tool definitions
 * Each tool is validated against the ToolDefinitionSchema
 */
export const tools: ToolDefinition[] = z.array(ToolDefinitionSchema).parse([
  exampleTool,
]);
