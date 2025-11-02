#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { loadPlugins } from './core/plugin_loader';
import { DaltonCLICommand, DaltonCLIPlugin } from './core/plugin_types';
import { ToolDefinition } from './core/schemas';
import { runFlow } from './core/flow_runner';
import { setSecret, getSecret } from './core/secret_manager';
import { startSession, endSession } from './core/session_logger';
import { aiProviders } from './config';
import { modelRegistry } from './model_registry';
import handleChat from './commands/chat';
import handleConfigure from './commands/configure';
import handlePrompt from './commands/prompt';

let selectedModelId: string | undefined;
let selectedProviderName: string | undefined;

const program = new Command();

async function handleModelSelection(): Promise<void> {
  const models = await modelRegistry;
  const modelChoices = Object.values(models)
    .filter(model => aiProviders[model.provider]?.enabled) // Only show models from enabled providers
    .map(model => ({
      name: `${chalk.blue(model.name)} (${model.id}) - Provider: ${model.provider}`,
      value: { id: model.id, provider: model.provider },
    }));

  if (modelChoices.length === 0) {
    console.log(chalk.yellow("No enabled models found. Please check your configuration."));
    return;
  }

  const { chosenModel } = await inquirer.prompt([
    {
      type: 'list',
      name: 'chosenModel',
      message: chalk.green('Select an AI model:'),
      choices: modelChoices,
    },
  ]);

  selectedModelId = chosenModel.id;
  selectedProviderName = chosenModel.provider;
  console.log(chalk.green(`Selected model: ${selectedModelId} from provider: ${selectedProviderName}`));
}

/**
 * Displays interactive menu when no command is provided
 * Shows main menu options: Start Chat, Run Flow, Configure, List Sessions, Exit
 * @returns Promise that resolves when menu action is complete
 */
async function showInteractiveMenu(): Promise<void> {
  console.log('\n' + chalk.bold.cyan('═'.repeat(60)));
  console.log(chalk.bold.cyan('  🤖 Welcome to Dalton CLI'));
  console.log(chalk.bold.cyan('═'.repeat(60)) + '\n');

  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: chalk.green('What would you like to do?'),
      choices: [
        {
          name: chalk.cyan('💬 Start Chat') + chalk.gray(' - Launch interactive chat session'),
          value: 'chat',
        },
        {
          name: chalk.blue('🧠 Select Model') + chalk.gray(' - Choose an AI model for chat'),
          value: 'select-model',
        },
        {
          name: chalk.yellow('⚡ Run Flow') + chalk.gray(' - Execute an action graph flow from YAML'),
          value: 'flow',
        },
        {
          name: chalk.magenta('⚙️  Configure') + chalk.gray(' - Access configuration menu'),
          value: 'configure',
        },
        {
          name: chalk.blue('📋 List Sessions') + chalk.gray(' - Show all saved chat sessions'),
          value: 'list-sessions',
        },
        {
          name: chalk.red('👋 Exit') + chalk.gray(' - Exit the CLI'),
          value: 'exit',
        },
      ],
    },
  ]);

  console.log(''); // Blank line for spacing

  switch (action) {
    case 'chat':
      await handleChat({ provider: selectedProviderName, model: selectedModelId });
      break;

    case 'select-model':
      await handleModelSelection();
      await showInteractiveMenu(); // Show menu again after selection
      break;

    case 'flow':
      const { flowPath } = await inquirer.prompt([
        {
          type: 'input',
          name: 'flowPath',
          message: chalk.yellow('Enter the path to your YAML flow file:'),
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return 'Please provide a valid file path';
            }
            return true;
          },
        },
      ]);
      await runFlow(flowPath, false, false, false);
      break;

    case 'configure':
      const { configAction } = await inquirer.prompt([
        {
          type: 'list',
          name: 'configAction',
          message: chalk.magenta('Select configuration action:'),
          choices: [
            { name: chalk.cyan('List') + chalk.gray(' - Show all configuration'), value: 'list' },
            { name: chalk.green('Get') + chalk.gray(' - Get a configuration value'), value: 'get' },
            { name: chalk.yellow('Set') + chalk.gray(' - Set a configuration value'), value: 'set' },
            { name: chalk.red('Unset') + chalk.gray(' - Remove a configuration value'), value: 'unset' },
            { name: chalk.blue('Manage Secrets') + chalk.gray(' - Manage secret keys'), value: 'secrets' },
          ],
        },
      ]);

      if (configAction === 'secrets') {
        const { secretAction } = await inquirer.prompt([
          {
            type: 'list',
            name: 'secretAction',
            message: chalk.blue('Select secret action:'),
            choices: [
              { name: 'Set Secret', value: 'set' },
              { name: 'Get Secret', value: 'get' },
            ],
          },
        ]);

        if (secretAction === 'set') {
          const { key, value } = await inquirer.prompt([
            { type: 'input', name: 'key', message: 'Secret key:' },
            { type: 'password', name: 'value', message: 'Secret value:', mask: '*' },
          ]);
          await setSecret(key, value);
        } else {
          const { key } = await inquirer.prompt([
            { type: 'input', name: 'key', message: 'Secret key:' },
          ]);
          const secret = await getSecret(key);
          if (secret) {
            console.log(chalk.green(`Secret for '${key}': ${secret}`));
          } else {
            console.log(chalk.yellow(`Secret for '${key}' not found.`));
          }
        }
      } else if (configAction === 'list') {
        handleConfigure(['list']);
      } else if (configAction === 'get') {
        const { type, service, key } = await inquirer.prompt([
          { type: 'input', name: 'type', message: 'Type (ai/mcp):' },
          { type: 'input', name: 'service', message: 'Service name:' },
          { type: 'input', name: 'key', message: 'Configuration key:' },
        ]);
        handleConfigure(['get', type, service, key]);
      } else if (configAction === 'set') {
        const { type, service, key, value } = await inquirer.prompt([
          { type: 'input', name: 'type', message: 'Type (ai/mcp):' },
          { type: 'input', name: 'service', message: 'Service name:' },
          { type: 'input', name: 'key', message: 'Configuration key:' },
          { type: 'input', name: 'value', message: 'Configuration value:' },
        ]);
        handleConfigure(['set', type, service, key, value]);
      } else if (configAction === 'unset') {
        const { type, service, key } = await inquirer.prompt([
          { type: 'input', name: 'type', message: 'Type (ai/mcp):' },
          { type: 'input', name: 'service', message: 'Service name:' },
          { type: 'input', name: 'key', message: 'Configuration key (optional):', default: '' },
        ]);
        handleConfigure(['unset', type, service, key].filter(v => v !== ''));
      }
      break;

    case 'list-sessions':
      await handleChat({ listSessions: true });
      break;

    case 'exit':
      console.log(chalk.cyan('👋 Goodbye!\n'));
      process.exit(0);
      break;
  }
}

/**
 * Main entry point for Dalton CLI application
 * Initializes the command-line interface with all available commands and handlers
 * Sets up session logging, plugin loading, and command execution
 */
async function main() {
  // Check if no commands were provided - show interactive menu
  if (process.argv.length === 2) {
    try {
      await showInteractiveMenu();
      process.exit(0);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('User force closed') || error.message.includes('closed'))) {
        console.log(chalk.cyan('\n👋 Goodbye!\n'));
        process.exit(0);
      }
      console.error(chalk.red('Error in interactive menu:'), error);
      process.exit(1);
    }
  }

  program
    .name('dalton-cli')
    .description('A custom CLI for interacting with various AI APIs.')
    .version('0.1.0')
    .option('--dry-run', 'Prints intended tool calls and commands without executing.', false)
    .option('--non-interactive', 'Disables interactive prompts for CI/CD.', false)
    .option('--provider <providerName>', 'Specify the AI provider to use.')
    .option('--model <modelName>', 'Specify the AI model to use.')
    .option('--session <sessionName>', 'Name the session save file.')
    .option('--allow-network', 'Allow tools to make network requests.', false);

  const options = program.opts();
  try {
    // Top-level chat command (direct access without shekinah prefix)
    program
      .command('prompt <message>')
      .description('Send a prompt to the AI')
      .option('-m, --model <modelName>', 'Specify the AI model to use (e.g., gpt-4, gpt-3.5-turbo)', 'gpt-3.5-turbo')
      .action(async (message: string, options: { model?: string, provider?: string }) => {
        await handlePrompt(message, options);
      });

    program
      .command('chat')
      .description('Starts an interactive chat session.')
      .option('--resume [sessionName]', 'Resume a previous chat session. Optionally provide a session name.')
      .option('--load <sessionName>', 'Load a specific chat session by name.')
      .option('--file <filePath>', 'Load a file as context for the chat.')
      .option('--save <sessionName>', 'Save the session with a specific name.')
      .option('--list-sessions', 'List all available saved sessions with metadata.')
      .option('--max-history <number>', 'Maximum number of messages to keep in context (default: 10, range: 1-1000).', parseInt)
      .action(async (chatOptions) => {
        // Merge global options (provider, model, nonInteractive) with chat-specific options
        const fullOptions = {
          ...chatOptions,
          provider: options.provider || chatOptions.provider,
          model: options.model || chatOptions.model,
          nonInteractive: options.nonInteractive || chatOptions.nonInteractive,
        };
        await handleChat(fullOptions);
      });

    // Shekinah commands
    const shekinahCommand = program.command('shekinah').description('Commands related to action graph flows and chat.');

    shekinahCommand
      .command('run <flowYamlPath>')
      .description('Runs an action graph flow defined in a YAML file.')
      .action(async (flowYamlPath: string) => {
        try {
          await runFlow(flowYamlPath, options.dryRun, options.nonInteractive, options.allowNetwork);
        } catch (error) {
          console.error(`Error running flow ${flowYamlPath}:`, error);
        }
      });

    shekinahCommand
      .command('chat')
      .description('Starts an interactive chat session.')
      .option('--resume [sessionName]', 'Resume a previous chat session. Optionally provide a session name.')
      .option('--load <sessionName>', 'Load a specific chat session by name.')
      .option('--file <filePath>', 'Load a file as context for the chat.')
      .option('--save <sessionName>', 'Save the session with a specific name.')
      .option('--list-sessions', 'List all available saved sessions with metadata.')
      .option('--max-history <number>', 'Maximum number of messages to keep in context (default: 10, range: 1-1000).', parseInt)
      .action(async (chatOptions) => {
        // Merge global options (provider, model, nonInteractive) with chat-specific options
        const fullOptions = {
          ...chatOptions,
          provider: options.provider || chatOptions.provider,
          model: options.model || chatOptions.model,
          nonInteractive: options.nonInteractive || chatOptions.nonInteractive,
        };
        await handleChat(fullOptions);
      });

    // Configure command for settings and secrets
    const configureCommand = program.command('configure').description('Configure Dalton CLI settings.');

    // Configure list subcommand
    configureCommand
      .command('list')
      .description('List all configuration settings.')
      .action(() => {
        handleConfigure(['list']);
      });

    // Configure get subcommand
    configureCommand
      .command('get <type> <service> <key>')
      .description('Get a configuration value.')
      .action((type: string, service: string, key: string) => {
        handleConfigure(['get', type, service, key]);
      });

    // Configure set subcommand
    configureCommand
      .command('set <type> <service> <key> <value>')
      .description('Set a configuration value.')
      .action((type: string, service: string, key: string, value: string) => {
        handleConfigure(['set', type, service, key, value]);
      });

    // Configure unset subcommand
    configureCommand
      .command('unset <type> <service> [key]')
      .description('Unset a configuration value.')
      .action((type: string, service: string, key?: string) => {
        handleConfigure(['unset', type, service, key].filter(v => v !== undefined));
      });

    // Configure secret subcommand for managing secrets
    const secretCommand = configureCommand.command('secret').description('Manage secrets.');

    secretCommand
      .command('set <key> <value>')
      .action(async (key: string, value: string) => {
        await setSecret(key, value);
      });

    secretCommand
      .command('get <key>')
      .description('Get a secret from the OS keychain or .env.')
      .action(async (key: string) => {
        const secret = await getSecret(key);
        if (secret) {
          console.log(`Secret for '${key}': ${secret}`);
        } else {
          console.log(`Secret for '${key}' not found.`);
        }
      });

    // Load plugins and integrate their commands and tools
    const loadedPlugins: DaltonCLIPlugin[] = await loadPlugins(process.cwd());

    loadedPlugins.forEach(plugin => {
      if (plugin.commands) {
        plugin.commands.forEach(cmd => {
          const command = program.command(cmd.name).description(cmd.description);
          cmd.options?.forEach(opt => {
            if (opt.defaultValue !== undefined) {
              command.option(opt.flags, opt.description, opt.defaultValue as string | boolean);
            } else {
              command.option(opt.flags, opt.description);
            }
          });
          command.action(cmd.action);
        });
      }
      if (plugin.tools) {
        plugin.tools.forEach(tool => console.log(`Plugin Tool: ${tool.name} - ${tool.description}`));
      }
    });

    // Add error handling for unrecognized commands
    program.on('command:*', (operands) => {
      console.error(chalk.red(`\n❌ Error: Unknown command '${operands[0]}'`));
      console.log(chalk.yellow('\nAvailable commands:'));
      console.log(chalk.cyan('  daltoncli') + chalk.gray('                      - Show interactive menu'));
      console.log(chalk.cyan('  daltoncli chat') + chalk.gray('                 - Start chat session'));
      console.log(chalk.cyan('  daltoncli shekinah chat') + chalk.gray('        - Start chat session (legacy)'));
      console.log(chalk.cyan('  daltoncli shekinah run <file>') + chalk.gray('   - Run a flow from YAML file'));
      console.log(chalk.cyan('  daltoncli configure list') + chalk.gray('       - List all configuration'));
      console.log(chalk.cyan('  daltoncli configure get') + chalk.gray('        - Get configuration value'));
      console.log(chalk.cyan('  daltoncli configure set') + chalk.gray('        - Set configuration value'));
      console.log(chalk.cyan('  daltoncli configure unset') + chalk.gray('      - Remove configuration value'));
      console.log(chalk.cyan('  daltoncli configure secret') + chalk.gray('     - Manage secrets\n'));
      console.log(chalk.gray('Run') + chalk.cyan(' daltoncli --help ') + chalk.gray('for more information.\n'));
      process.exit(1);
    });

    console.log("Dalton CLI initialized. Ready to parse commands.");
    program.parse(process.argv);
  } finally {
    await endSession();
  }
}

main().catch((error) => {
  console.error(chalk.red('\n❌ Fatal error:'), error);
  process.exit(1);
});