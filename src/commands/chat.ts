const inquirer = require('inquirer');
const chalk = require('chalk');
const os = require('os');
const { getAvailableModels } = require('../core/model_registry');
const { getProvider } = require('../core/api_client');
const { metaprompt } = require('../core/system_prompt');
const { readConfig } = require('../core/config');
const { handleFs, isPathSafe } = require('./fs');
const handleShell = require('./shell');
const { tools } = require('../core/tools');
const fs = require('fs');
const path = require('path');

const HISTORY_LIMIT = 10;
// Use OS-appropriate app data directory
const APP_DATA_DIR = path.join(os.homedir(), '.dalton-cli');
const SESSIONS_DIR = path.join(APP_DATA_DIR, 'sessions');
const LAST_SESSION_NAME = '__last_session';

// --- Session Management ---
const saveSession = (name, history) => {
  if (!fs.existsSync(APP_DATA_DIR)) fs.mkdirSync(APP_DATA_DIR);
  if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR);
  const filePath = path.join(SESSIONS_DIR, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(history, null, 2));
};

const loadSession = (name) => {
  const filePath = path.join(SESSIONS_DIR, `${name}.json`);
  if (!fs.existsSync(filePath)) return null;
  const rawData = fs.readFileSync(filePath);
  return JSON.parse(rawData);
};

// --- Core Logic ---
const getConfiguredProviders = () => Object.keys(readConfig().ai_providers || {});

const executeToolCall = async (toolCall) => {
  const { name, arguments: argsStr } = toolCall.function;
  let args;
  try {
    args = JSON.parse(argsStr);
  } catch (error) {
    return { tool_call_id: toolCall.id, role: 'tool', name, content: `Error parsing arguments: ${error.message}` };
  }

  console.log(chalk.blue(`\nShekinah wants to call tool: ${name} with args:`), args);
  let result;
  if (name === 'execute_shell_command') result = await handleShell(args.command, true);
  else if (name === 'read_file_content') result = await handleFs('read', [args.file_path], true);
  else if (name === 'list_render_services') result = await listRenderServices();
  else result = `Unknown tool: ${name}`;
  return { tool_call_id: toolCall.id, role: 'tool', name, content: String(result) };
};

const chatLoop = async (provider, model, initialHistory, sessionName) => {
  let sessionHistory = initialHistory;
  console.log(chalk.blue(`Starting chat with ${provider.providerName}: ${model}.`));
  console.log(chalk.yellow('Type 'exit' or 'quit' to end. Press Ctrl+C to interrupt.'));

  const saveAndExit = () => {
    saveSession(sessionName || LAST_SESSION_NAME, sessionHistory);
    console.log(chalk.magenta(`\nSession saved as '${sessionName || LAST_SESSION_NAME}'. Exiting.`));
    process.exit();
  };

  process.on('SIGINT', saveAndExit);

  while (true) {
    const { prompt } = await inquirer.prompt([{ type: 'input', name: 'prompt', message: chalk.green('You: ') }]);
    if (['exit', 'quit'].includes(prompt.toLowerCase())) {
      saveAndExit();
      break;
    }

    sessionHistory.push({ role: 'user', content: prompt });

    try {
      const stream = await provider.getChatCompletion(sessionHistory, { model, tools, tool_choice: 'auto' });
      let fullResponse = '';
      let toolCalls = [];
      
      process.stdout.write(chalk.cyan('Shekinah: '));
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        const toolCallChunk = chunk.choices[0]?.delta?.tool_calls;
        process.stdout.write(chalk.cyan(content));
        fullResponse += content;
        if (toolCallChunk) {
          toolCallChunk.forEach(t => {
            if (!toolCalls[t.index]) toolCalls[t.index] = { id: '', function: { name: '', arguments: '' } };
            if (t.id) toolCalls[t.index].id += t.id;
            if (t.function.name) toolCalls[t.index].function.name += t.function.name;
            if (t.function.arguments) toolCalls[t.index].function.arguments += t.function.arguments;
          });
        }
      }
      process.stdout.write('\n');
      sessionHistory.push({ role: 'assistant', content: fullResponse });

      if (toolCalls.length > 0) {
        sessionHistory.pop();
        sessionHistory.push({ role: 'assistant', tool_calls: toolCalls });
        const toolResults = await Promise.all(toolCalls.map(executeToolCall));
        sessionHistory.push(...toolResults);
        const finalStream = await provider.getChatCompletion(sessionHistory, { model, tools, tool_choice: 'auto' });
        let finalResponseText = '';
        process.stdout.write(chalk.cyan('Shekinah: '));
        for await (const chunk of finalStream) {
          const content = chunk.choices[0]?.delta?.content || '';
          process.stdout.write(chalk.cyan(content));
          finalResponseText += content;
        }
        process.stdout.write('\n');
        sessionHistory.push({ role: 'assistant', content: finalResponseText });
      }
    } catch (error) {
      const errorMessage = `An error occurred: ${error.message}`;
      console.error(chalk.red(`\n${errorMessage}`));
      sessionHistory.push({ role: 'assistant', content: `(System: The previous attempt failed with an error: ${error.message})` });
    }
  }
};

const handleChat = async (options) => {
  let initialHistory = null;
  let sessionName = options.save;

  if (options.resume) initialHistory = loadSession(LAST_SESSION_NAME);
  else if (options.load) {
    initialHistory = loadSession(options.load);
    sessionName = options.load;
  }

  if (!initialHistory) initialHistory = [{ role: 'system', content: metaprompt }];

  if (options.file) {
    if (!isPathSafe(options.file)) {
      console.error(chalk.red('Error: Cannot access file outside of project directory.'));
      return;
    }
    try {
      const fileContent = fs.readFileSync(options.file, 'utf-8');
      initialHistory.push({ role: 'system', content: `File context: ${options.file}\n${fileContent}` });
    } catch (error) {
      console.error(chalk.red(`Error reading file: ${error.message}`));
      return;
    }
  }

  const configuredProviders = getConfiguredProviders();
  if (configuredProviders.length === 0) {
    console.error(chalk.red('No AI providers configured.'));
    return;
  }

  let providerName = options.provider;
  if (!providerName) {
    if (configuredProviders.length === 1) {
      providerName = configuredProviders[0];
    } else {
      const answer = await inquirer.prompt([{ 
        type: 'list', name: 'providerName', message: 'Select an AI Provider:', choices: configuredProviders,
      }]);
      providerName = answer.providerName;
    }
  }

  let model = options.model;
  if (!model) {
    const availableModels = getAvailableModels([providerName]);
    const { selectedModel } = await inquirer.prompt([{ 
      type: 'list', name: 'selectedModel', message: `Select a model from ${providerName}:`,
      choices: availableModels.map(m => ({ name: m.name.split(': ')[1], value: m.value.model })),
    }]);
    model = selectedModel;
  }

  try {
    const provider = getProvider(providerName);
    await chatLoop(provider, model, initialHistory, sessionName);
  } catch (error) {
    console.error(chalk.red(error.message));
  }
};

module.exports = handleChat;