const { readConfig, setConfigValue, getConfigValue, unsetConfigValue } = require('../core/config');
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

const printUsage = () => {
  console.log(chalk.yellow('Usage:'));
  console.log('  dalton-cli configure list');
  console.log('  dalton-cli configure get <type> <service> <key>');
  console.log('  dalton-cli configure set <type> <service> <key> <value>');
  console.log('  dalton-cli configure unset <type> <service> [key]');
  console.log(chalk.gray('\n  <type> can be 'ai' or 'mcp'.'));
}

const handleConfigure = (args) => {
  const [action, type, service, key, value] = args;

  switch (action) {
    case 'list':
      listConfig();
      break;
    case 'get':
      if (!type || !service || !key) {
        console.error(chalk.red("Error: 'get' requires a type, service, and key."));
        printUsage();
        return;
      }
      getConfigValue(type, service, key);
      break;
    case 'set':
      if (!type || !service || !key || !value) {
        console.error(chalk.red("Error: 'set' requires a type, service, key, and value."));
        printUsage();
        return;
      }
      setConfigValue(type, service, key, value);
      break;
    case 'unset':
      if (!type || !service) {
        console.error(chalk.red("Error: 'unset' requires a type and a service."));
        printUsage();
        return;
      }
      unsetConfigValue(type, service, key);
      break;
    default:
      console.error(chalk.red(`Error: Unknown action '${action || ''}'.`));
      printUsage();
  }
};

module.exports = handleConfigure;