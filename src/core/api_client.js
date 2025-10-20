const { OpenAI } = require('openai');
const { openaiApiKey, azureApiKey, azureApiEndpoint } = require('./config');
const { tools } = require('./tools'); // Import the tool definitions

const getOpenAIClient = (provider) => {
  if (provider === 'azure') {
    if (!azureApiKey || !azureApiEndpoint) {
      throw new Error('Azure API key or endpoint not configured. Please use \'dalton-cli configure set azure <key> <endpoint>\'.');
    }
    return new OpenAI({
      apiKey: azureApiKey,
      baseURL: azureApiEndpoint,
    });
  } else {
    // Default to standard OpenAI
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured. Please use \'dalton-cli configure set openai <key>\'.');
    }
    return new OpenAI({ apiKey: openaiApiKey });
  }
};

const sendPromptToAI = async (messages, options = {}) => {
  const { model = 'gpt-3.5-turbo', provider = 'openai' } = options;
  const openai = getOpenAIClient(provider);

  try {
    console.log(`Sending conversation to ${provider} with model: ${model}...`);
    const completion = await openai.chat.completions.create({
      messages: messages,
      model: model,
      tools: tools, // Send the tool definitions
      tool_choice: 'auto', // Let the model decide when to call a function
    });

    return completion.choices[0]; // Return the entire choice object
  } catch (error) {
    console.error(`Error communicating with ${provider}:`, error.message);
    throw error;
  }
};

module.exports = { sendPromptToAI };
