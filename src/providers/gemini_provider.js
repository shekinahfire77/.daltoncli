const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require('@google/generative-ai');
const { readConfig } = require('../core/config');

// Adapter function to convert OpenAI-style tools to Gemini format
const convertToolsToGemini = (tools) => {
  if (!tools) return null;
  return tools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters,
  }));
};

// Adapter function to convert Gemini stream chunks to OpenAI-compatible format
async function* adaptGeminiStreamToOpenAI(stream) {
  for await (const chunk of stream) {
    const adaptedChunk = {
      choices: [{
        delta: {
          content: chunk.text(),
          tool_calls: null, // Gemini SDK handles tool calls in a single response, not streamed
        },
      }],
    };
    yield adaptedChunk;
  }
}

class GeminiProvider {
  constructor() {
    this.providerName = 'gemini';
    this.client = this._createClient();
  }

  _createClient() {
    const config = readConfig();
    const providerConfig = config.ai_providers?.[this.providerName];
    if (!providerConfig || !providerConfig.api_key) {
      throw new Error('Gemini API key not configured. Use \'dalton-cli configure ai set gemini api_key <key>\'');
    }
    return new GoogleGenerativeAI(providerConfig.api_key);
  }

  async getChatCompletion(messages, options) {
    const { model, tools } = options;
    const generativeModel = this.client.getGenerativeModel({
      model,
      tools: { functionDeclarations: convertToolsToGemini(tools) },
      // Safety settings are important for Gemini
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    });

    // Gemini handles history differently, needs to be user/model/user/model...
    // This is a simplification; a robust implementation would handle this more carefully.
    const history = messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.content }],
    }));
    const lastUserPrompt = messages[messages.length - 1].content;

    const chat = generativeModel.startChat({ history });
    const result = await chat.sendMessageStream(lastUserPrompt);

    // The Gemini SDK does not stream tool calls. It sends them as a single response part.
    // We check for that first. If there are tool calls, we can't stream the response.
    const response = await result.response;
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      // If there are tool calls, we can't stream. We have to return a single, adapted response.
      const tool_calls = functionCalls.map((fc, i) => ({
        index: i,
        id: fc.name, // Gemini doesn't have a unique call ID, so we reuse the name
        function: {
          name: fc.name,
          arguments: JSON.stringify(fc.args),
        },
      }));
      // Return a single chunk that looks like an OpenAI tool call response
      return [{ choices: [{ delta: { tool_calls } }] }];
    }

    // If no tool calls, adapt the text stream to look like OpenAI's
    return adaptGeminiStreamToOpenAI(result.stream);
  }
}

module.exports = GeminiProvider;
