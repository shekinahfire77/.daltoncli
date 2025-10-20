#!/usr/bin/env node

const { Command } = require('commander');
const program = new Command();
const handlePrompt = require('../src/commands/prompt');
const handleConfigure = require('../src/commands/configure');
const handleFs = require('../src/commands/fs');
const handleShell = require('../src/commands/shell');
const handleChat = require('../src/commands/chat');

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
  .action(handleChat);

program
  .command('configure [args...]')
  .description('Configure AI providers and MCP integrations (e.g., 'list' or 'ai set openai api_key ...')')
  .action(handleConfigure);

program
  .command('fs <action> [args...]')
  .description('Perform filesystem operations (actions: read)')
  .action(handleFs);

program
  .command('shell <command>')
  .description('Execute a shell command')
  .action(handleShell);

program.parse(process.argv);
