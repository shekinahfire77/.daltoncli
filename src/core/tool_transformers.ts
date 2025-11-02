import { Tool } from './tools';
import { OpenAI } from 'openai';

export function transformToOpenAITools(tools: Tool[] | undefined): OpenAI.ChatCompletionTool[] {
  if (!tools) {
    return [];
  }
  return tools.map(tool => ({
    type: 'function',
    function: {
      name: tool.function.name,
      description: tool.function.description,
      parameters: tool.function.parameters,
    },
  }));
}