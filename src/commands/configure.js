const { readConfig, setConfigValue } = require('../core/config');
const chalk = require('chalk');

const listConfig = () => {
  const config = readConfig();
  console.log(chalk.bold('AI Providers:'));
  const aiProviders = config.ai_providers || {};
  if (Object.keys(aiProviders).length > 0) {
    Object.keys(aiProviders).forEach(provider => console.log(`- ${provider}`));
  } else {
    console.log('  (none)');
  }

  console.log(chalk.bold('\nMCP Integrations:'));
  const mcpIntegrations = config.mcp_integrations || {};
  if (Object.keys(mcpIntegrations).length > 0) {
    Object.keys(mcpIntegrations).forEach(integration => console.log(`- ${integration}`));
  } else {
    console.log('  (none)');
  }
};

const handleConfigure = (args) => {
  const [type, action, service, key, value] = args;

  if (type === 'list') {
    listConfig();
    return;
  }

  if (action === 'set') {
    if (!type || !service || !key || !value) {
      console.error(chalk.red('Error: Invalid 'set' command structure.'));
      console.log('Usage: dalton-cli configure <type> set <service> <key> <value>');
      console.log('  <type>: 'ai' or 'mcp'');
      return;
    }
    if (!['ai', 'mcp'].includes(type)) {
      console.error(chalk.red('Error: Invalid type. Must be 'ai' or 'mcp'.'));
      return;
    }
    setConfigValue(type, service, key, value);
  } else {
    console.error(chalk.red(`Error: Unknown action or command structure.`));
    console.log('Usage: dalton-cli configure list');
    console.log('Usage: dalton-cli configure <type> set <service> <key> <value>');
  }
};

module.exports = handleConfigure;
