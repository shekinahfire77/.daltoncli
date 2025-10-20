import { z } from 'zod';
import { ToolDefinitionSchema, ToolDefinition } from './core/schemas';

// Example tool definition (replace with actual tools)
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
  func: (param1: string) => {
    console.log(`Example tool called with: ${param1}`);
    return `Result of exampleTool with ${param1}`;
  },
};

export const tools: ToolDefinition[] = z.array(ToolDefinitionSchema).parse([
  exampleTool,
  // Add more tools here
]);
