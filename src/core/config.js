const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const configPath = path.resolve(__dirname, '../../config.json');

const readConfig = () => {
  try {
    if (!fs.existsSync(configPath)) {
      // Create a default config if it doesn't exist
      const defaultConfig = { ai_providers: {}, mcp_integrations: {} };
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }
    const rawData = fs.readFileSync(configPath);
    return JSON.parse(rawData);
  } catch (error) {
    console.error(chalk.red('Error reading config file:'), error);
    return { ai_providers: {}, mcp_integrations: {} };
  }
};

const writeConfig = (config) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error(chalk.red('Error writing to config file:'), error);
  }
};

const getConfigValue = (key) => {
  const config = readConfig();
  return config[key];
}

const setConfigValue = (type, service, key, value) => {
  const config = readConfig();
  const category = type === 'ai' ? 'ai_providers' : 'mcp_integrations';

  if (!config[category]) {
    config[category] = {};
  }
  if (!config[category][service]) {
    config[category][service] = {};
  }
  config[category][service][key] = value;
  writeConfig(config);
  console.log(chalk.green(`Configuration updated for ${service}.`));
};

module.exports = { readConfig, setConfigValue, getConfigValue };