const { OpenAI } = require('openai');
const { readConfig } = require('../core/config');

class OpenAIProvider {
  constructor(providerName) {
    this.providerName = providerName;
    this.client = this._createClient();
  }

  _createClient() {
    const config = readConfig();
    const aiProviders = config.ai_providers || {};
    const providerConfig = aiProviders[this.providerName];

    if (!providerConfig || !providerConfig.api_key) {
      throw new Error(`${this.providerName} API key not configured. Use 'dalton-cli configure ai set ${this.providerName} api_key <key>'`);
    }

    // This handles standard OpenAI, Azure, and any other OpenAI-compatible API
    const baseURL = providerConfig.api_endpoint; // This will be undefined for standard OpenAI, which is correct

    return new OpenAI({
      apiKey: providerConfig.api_key,
      baseURL: baseURL,
    });
  }

  async getChatCompletion(messages, options) {
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

module.exports = OpenAIProvider;
