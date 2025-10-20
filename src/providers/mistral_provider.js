const MistralClient = require('@mistralai/mistralai');
const { readConfig } = require('../core/config');

class MistralProvider {
  constructor() {
    this.providerName = 'mistral';
    this.client = this._createClient();
  }

  _createClient() {
    const config = readConfig();
    const aiProviders = config.ai_providers || {};
    const providerConfig = aiProviders[this.providerName];

    if (!providerConfig || !providerConfig.api_key) {
      throw new Error('Mistral API key not configured. Use \'dalton-cli configure ai set mistral api_key <key>\'');
    }

    return new MistralClient(providerConfig.api_key);
  }

  async getChatCompletion(messages, options) {
    const { model, tools, tool_choice } = options;

    // Mistral's tool format is compatible with OpenAI's, so no major transformation is needed.
    // The Mistral client's chatStream method is an async generator, just like OpenAI's stream.
    return this.client.chatStream({
      model,
      messages,
      tools,
      toolChoice: tool_choice,
    });
  }
}

module.exports = MistralProvider;
