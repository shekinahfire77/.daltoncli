
import MistralClient from '@mistralai/mistralai';
import { readConfig } from '../core/config';
import { ChatMessage } from '../core/schemas';
import { Tool } from '../core/tools';

interface ChatCompletionOptions {
  model: string;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
}

class MistralProvider {
  private providerName: string;
  private client: MistralClient;

  constructor() {
    this.providerName = 'mistral';
    this.client = this._createClient();
  }

  private _createClient(): MistralClient {
    const config = readConfig();
    const aiProviders = config.ai_providers || {};
    const providerConfig = aiProviders[this.providerName];

    if (!providerConfig || !providerConfig.api_key) {
      throw new Error('Mistral API key not configured. Use \'dalton-cli configure ai set mistral api_key <key>\'');
    }

    return new MistralClient(providerConfig.api_key);
  }

  public async getChatCompletion(messages: ChatMessage[], options: ChatCompletionOptions) {
    const { model, tools, tool_choice } = options;

    return this.client.chatStream({
      model,
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content || '',
        tool_calls: msg.tool_calls as any, // Mistral expects tool_calls to be in a specific format
      })),
      tools: tools as any, // Mistral expects tools to be in a specific format
      toolChoice: tool_choice as any,
    });
  }
}

export default MistralProvider;
