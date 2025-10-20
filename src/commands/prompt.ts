const chalk = require('chalk');
const { getProvider } = require('../core/api_client');
const { tools } = require('../core/tools');

const handlePrompt = async (message, options) => {
  try {
    // Default to 'openai' provider for simple prompts, can be changed later
    const providerName = options.provider || 'openai'; 
    const provider = getProvider(providerName);

    const messages = [{ role: 'user', content: message }];
    const stream = await provider.getChatCompletion(messages, {
      model: options.model || 'gpt-3.5-turbo', // Use specified model or default
      tools: tools,
      tool_choice: 'auto',
    });

    let fullResponse = '';
    console.log(chalk.cyan('Shekinah:'));
    for await (const chunk of stream) {
      fullResponse += chunk.choices[0]?.delta?.content || '';
    }
    // Note: This simple command does not handle tool calls for now.
    console.log(fullResponse);

  } catch (error) {
    console.error(chalk.red(`
Failed to get a response: ${error.message}`));
    process.exit(1);
  }
};

module.exports = handlePrompt;