const inquirer = require('inquirer');
const chalk = require('chalk');
const { getAvailableModels } = require('../core/model_registry');
const { sendPromptToAI } = require('../core/api_client');
const { metaprompt } = require('../core/system_prompt');
const handleShell = require('./shell');
const handleFs = require('./fs');
const fs = require('fs');
const path = require('path');

const HISTORY_LIMIT = 10; // Number of turns before summarization

// Function to get the list of configured providers from the .env file
const getConfiguredProviders = () => {
  const envPath = path.resolve(__dirname, '../../.env');
  if (!fs.existsSync(envPath)) return [];
  const fileContent = fs.readFileSync(envPath, { encoding: 'utf-8' });
  const providers = new Set();
  fileContent.split('\n').forEach(line => {
    const [key] = line.split('=');
    if (key) {
      if (key.endsWith('_API_KEY')) providers.add(key.replace('_API_KEY', '').toLowerCase());
      if (key.endsWith('_API_ENDPOINT')) providers.add(key.replace('_API_ENDPOINT', '').toLowerCase());
    }
  });
  return [...providers];
};

const summarizeHistory = async (history, options) => {
  console.log(chalk.gray('\nSummarizing conversation history to save tokens...'));
  const summarizationPrompt = [
    { role: 'system', content: 'You are a conversation summarizer. Condense the following chat into a single, dense paragraph. Retain all key facts, decisions, proper nouns, and code snippets.' },
    ...history
  ];
  try {
    const summaryResponse = await sendPromptToAI(summarizationPrompt, options);
    const summaryText = summaryResponse.message.content;
    console.log(chalk.gray('Summarization complete.'));
    return { role: 'system', content: `Summary of the conversation so far: ${summaryText}` };
  } catch (error) {
    console.error(chalk.red('Failed to summarize history.'));
    return null; // If summarization fails, we keep the old history
  }
};

const executeToolCall = async (toolCall) => {
  const functionName = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments);
  console.log(chalk.blue(`Shekinah wants to call tool: ${functionName} with args:`, args));

  let result;
  if (functionName === 'execute_shell_command') {
    result = await handleShell(args.command, true);
  } else if (functionName === 'read_file_content') {
    result = await handleFs('read', [args.file_path], true);
  } else {
    result = `Unknown tool: ${functionName}`;
  }
  return { tool_call_id: toolCall.id, role: 'tool', name: functionName, content: result };
}

const chatLoop = async (provider, model) => {
  let sessionHistory = [{ role: 'system', content: metaprompt }];
  console.log(chalk.blue(`Starting chat with ${provider}: ${model}.`));
  console.log(chalk.yellow('Type 'exit' or 'quit' to end the session. Press Ctrl+C to interrupt.'));

  process.on('SIGINT', () => {
    console.log(chalk.red('\nCaught interrupt signal. Exiting gracefully.'));
    process.exit();
  });

  while (true) {
    const { prompt } = await inquirer.prompt([{ type: 'input', name: 'prompt', message: chalk.green('You:') }]);
    if (['exit', 'quit'].includes(prompt.toLowerCase())) {
      console.log(chalk.blue('Ending chat session.'));
      break;
    }

    sessionHistory.push({ role: 'user', content: prompt });

    // Summarization Logic
    if (sessionHistory.length > HISTORY_LIMIT) {
      const historyToSummarize = sessionHistory.slice(1, -3); // Summarize all but the system prompt and last interaction
      const summary = await summarizeHistory(historyToSummarize, { model, provider });
      if (summary) {
        const recentHistory = sessionHistory.slice(-3);
        sessionHistory = [sessionHistory[0], summary, ...recentHistory];
      }
    }

    try {
      let response = await sendPromptToAI(sessionHistory, { model, provider });
      let message = response.message;

      while (message.tool_calls) {
        sessionHistory.push(message);
        const toolResults = [];
        for (const toolCall of message.tool_calls) {
          const result = await executeToolCall(toolCall);
          toolResults.push(result);
        }
        sessionHistory.push(...toolResults);
        response = await sendPromptToAI(sessionHistory, { model, provider });
        message = response.message;
      }

      const finalResponse = message.content;
      sessionHistory.push({ role: 'assistant', content: finalResponse });
      console.log(chalk.cyan('Shekinah:'), finalResponse);

    } catch (error) {
      sessionHistory.pop();
      console.error(chalk.red('\nAn error occurred.'));
    }
  }
};

const handleChat = async () => {
  const configuredProviders = getConfiguredProviders();
  if (configuredProviders.length === 0) {
    console.error(chalk.red('No AI providers configured. Use 'dalton-cli configure set <provider> <key>' first.'));
    return;
  }
  const availableModels = getAvailableModels(configuredProviders);
  const { selectedModel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'selectedModel',
      message: 'Select an AI model to chat with:',
      choices: availableModels,
    }
  ]);
  const { provider, model } = selectedModel;
  await chatLoop(provider, model);
};

module.exports = handleChat;