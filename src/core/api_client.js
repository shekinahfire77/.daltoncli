const { OpenAI } = require('openai');
const { readConfig } = require('./config');
const { tools } = require('./tools');

const getOpenAIClient = (provider) => {
  const config = readConfig();
  const aiProviders = config.ai_providers || {};
  const providerConfig = aiProviders[provider];

  if (!providerConfig || !providerConfig.api_key) {
    throw new Error(`${provider} API key not configured. Please use \'dalton-cli configure ai set ${provider} api_key <key>\'.`);
  }

  if (provider === 'azure') {
    if (!providerConfig.api_endpoint) {
      throw new Error('Azure API endpoint not configured. Please use \'dalton-cli configure ai set azure api_endpoint <endpoint>\'.');
    }
    return new OpenAI({
      apiKey: providerConfig.api_key,
      baseURL: providerConfig.api_endpoint,
    });
  } else {
    return new OpenAI({ apiKey: providerConfig.api_key });
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
