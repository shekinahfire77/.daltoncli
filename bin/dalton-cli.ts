#!/usr/bin/env node

import { Command } from 'commander';
import handlePrompt from '../src/commands/prompt';
import handleConfigure from '../src/commands/configure';
import { handleFs } from '../src/commands/fs';
import handleShell from '../src/commands/shell';
import handleChat from '../src/commands/chat';

const program = new Command();

program
  .version('0.1.0')
  .description('A custom CLI for interacting with various AI APIs.');

program
  .command('prompt <message>')
  .description('Send a prompt to the AI')
  .option('-m, --model <modelName>', 'Specify the AI model to use (e.g., gpt-4, gpt-3.5-turbo)', 'gpt-3.5-turbo')
  .action(handlePrompt);

program
  .command('chat')
  .description('Start an interactive chat session with a selected AI model')
  .option('-f, --file <path>', 'Path to a file to add to the chat context')
  .option('-r, --resume', 'Resume the last chat session')
  .option('-l, --load <name>', 'Load a specific chat session')
  .option('-s, --save <name>', 'Save the session with a specific name on exit')
  .option('--list-sessions', 'List all available saved sessions with metadata')
  .option('--max-history <number>', 'Maximum number of messages to keep in context (default: 10, range: 1-1000)', parseInt)
  .action(handleChat);

program
  .command('configure [args...]')
  .description('Configure AI providers and MCP integrations (e.g., "list" or "ai set openai api_key ...")')
  .action(handleConfigure);

program
  .command('fs <action> [args...]')
  .description('Perform filesystem operations (actions: read)')
  .action(async (action: string, args: string[]) => {
    await handleFs(action, args);
  });

program
  .command('shell <command>')
  .description('Execute a shell command')
  .action(async (command: string) => {
    await handleShell(command);
  });

program.parse(process.argv);
