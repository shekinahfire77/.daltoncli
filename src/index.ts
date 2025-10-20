import { Command } from 'commander';
import { loadPlugins } from './core/plugin_loader';
import { DaltonCLICommand, DaltonCLIPlugin } from './core/plugin_types';
import { ToolDefinition } from './core/schemas';
import { runFlow } from './core/flow_runner';
import { setSecret, getSecret } from './core/secret_manager';
import { startSession, endSession } from './core/session_logger';
import { config } from './config'; // Import config to check providers
import { modelRegistry } from './model_registry'; // Import modelRegistry

const program = new Command();

async function main() {
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
  await startSession(options.session); // Start session logging with optional session name

  try {
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
      .action(async (chatOptions) => {
        console.log("Starting chat session...");
        let sessionToResume = chatOptions.resume;

        // Auto-resume if only one provider is configured and --resume is not explicitly false
        const availableProviders = Object.values(modelRegistry).reduce((acc: { [key: string]: boolean }, model: any) => { acc[model.provider] = true; return acc; }, {});
        if (availableProviders.length === 1 && chatOptions.resume === undefined) {
          console.log("Auto-resuming chat as only one provider is configured.");
          // Logic to find the latest session for the single provider
          // For now, this is a placeholder
          sessionToResume = "latest_single_provider_session"; 
        }

        if (sessionToResume) {
          console.log(`Resuming chat session: ${sessionToResume}`);
          // Logic to load chat history from session file
        } else {
          console.log("Starting new chat session.");
        }

        // Placeholder for actual chat loop
        console.log("Chat functionality to be implemented.");
      });

    // Configure command for secrets
    const configureCommand = program.command('configure').description('Configure Dalton CLI settings.');
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
          cmd.options?.forEach(opt => command.option(opt.flags, opt.description, opt.defaultValue));
          command.action(cmd.action);
        });
      }
      if (plugin.tools) {
        plugin.tools.forEach(tool => console.log(`Plugin Tool: ${tool.name} - ${tool.description}`));
      }
    });

    console.log("Dalton CLI initialized. Ready to parse commands.");
    program.parse(process.argv);
  } finally {
    await endSession();
  }
