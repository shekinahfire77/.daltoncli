
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, FunctionDeclarationSchema } from '@google/generative-ai';
import { readConfig } from '../core/config';
import { ChatMessage } from '../core/schemas';
import { Tool } from '../core/tools';

// Adapter function to convert OpenAI-style tools to Gemini format
const convertToolsToGemini = (tools: Tool[] | undefined): FunctionDeclarationSchema[] | undefined => {
  if (!tools) return undefined;
  return tools.map(tool => ({
    name: tool.function.name,
    description: tool.function.description,
    parameters: tool.function.parameters as FunctionDeclarationSchema['parameters'],
  }));
};

// Adapter function to convert Gemini stream chunks to OpenAI-compatible format
async function* adaptGeminiStreamToOpenAI(stream: AsyncGenerator) {
  for await (const chunk of stream) {
    const adaptedChunk = {
      choices: [{
        delta: {
          content: chunk.text(),
          tool_calls: undefined, // Gemini SDK handles tool calls in a single response, not streamed
        },
      }],
    };
    yield adaptedChunk;
  }
}

interface ChatCompletionOptions {
  model: string;
  tools?: Tool[];
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
}

class GeminiProvider {
  private providerName: string;
  private client: GoogleGenerativeAI;

  constructor() {
    this.providerName = 'gemini';
    this.client = this._createClient();
  }

  private _createClient(): GoogleGenerativeAI {
    const config = readConfig();
    const providerConfig = config.ai_providers?.[this.providerName];
    if (!providerConfig || !providerConfig.api_key) {
      throw new Error('Gemini API key not configured. Use \'dalton-cli configure ai set gemini api_key <key>\'');
    }
    return new GoogleGenerativeAI(providerConfig.api_key);
  }

  public async getChatCompletion(messages: ChatMessage[], options: ChatCompletionOptions): Promise<any> {
    const { model, tools } = options;
    const generativeModel = this.client.getGenerativeModel({
      model,
      tools: { functionDeclarations: convertToolsToGemini(tools) },
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ],
    });

    const history = messages.filter(m => m.role === 'user' || m.role === 'assistant').map(m => ({
      role: m.role === 'assistant' ? 'model' : m.role,
      parts: [{ text: m.content || '' }],
    }));
    const lastUserPrompt = messages[messages.length - 1].content || '';

    const chat = generativeModel.startChat({ history });
    const result = await chat.sendMessageStream(lastUserPrompt);

    const response = await result.response;
    const functionCalls = response.functionCalls();
    if (functionCalls && functionCalls.length > 0) {
      const tool_calls = functionCalls.map((fc, i) => ({
        index: i,
        id: fc.name, // Gemini doesn't have a unique call ID, so we reuse the name
        function: {
          name: fc.name,
          arguments: JSON.stringify(fc.args),
        },
      }));
      return [{ choices: [{ delta: { tool_calls } }] }];
    }

    return adaptGeminiStreamToOpenAI(result.stream);
  }
}

export default GeminiProvider;
