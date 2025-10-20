
import OpenAI from 'openai';
import { readConfig } from '../core/config';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { Tool } from '../core/tools';

interface ChatCompletionOptions {
  model: string;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
}

class OpenAIProvider {
  private providerName: string;
  private client: OpenAI;

  constructor(providerName: string) {
    this.providerName = providerName;
    this.client = this._createClient();
  }

  private _createClient(): OpenAI {
    const config = readConfig();
    const aiProviders = config.ai_providers || {};
    const providerConfig = aiProviders[this.providerName];

    if (!providerConfig || !providerConfig.api_key) {
      throw new Error(`${this.providerName} API key not configured. Use 'dalton-cli configure ai set ${this.providerName} api_key <key>'`);
    }

    const baseURL = providerConfig.api_endpoint;

    return new OpenAI({
      apiKey: providerConfig.api_key,
      baseURL: baseURL,
    });
  }

  public async getChatCompletion(messages: ChatCompletionMessageParam[], options: ChatCompletionOptions) {
    const { model, tools, tool_choice } = options;

    return await this.client.chat.completions.create({
      messages,
      model,
      tools,
      tool_choice,
      stream: true,
    });
  }
}

export default OpenAIProvider;
