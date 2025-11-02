import chalk from 'chalk';
import { readConfig, setConfigValue, getConfigValue, unsetConfigValue, AppConfig } from '../core/config';

/**
 * Type definition for configuration action types
 */
type ConfigActionType = 'ai' | 'mcp';

/**
 * Displays the current configuration listing all AI providers and MCP integrations
 */
const listConfig = (): void => {
  const config: AppConfig = readConfig();
  console.log(chalk.bold('AI Providers:'));
  const aiProviders = config.ai_providers || {};
  if (Object.keys(aiProviders).length > 0) {
    Object.keys(aiProviders).forEach((provider: string) => console.log(`- ${provider}`));
  } else {
    console.log('  (none)');
  }

  console.log(chalk.bold('\nMCP Integrations:'));
  const mcpIntegrations = config.mcp_integrations || {};
  if (Object.keys(mcpIntegrations).length > 0) {
    Object.keys(mcpIntegrations).forEach((integration: string) => console.log(`- ${integration}`));
  } else {
    console.log('  (none)');
  }
};

/**
 * Displays usage information for the configure command
 */
const printUsage = (): void => {
  console.log(chalk.yellow('Usage:'));
  console.log('  dalton-cli configure list');
  console.log('  dalton-cli configure get <type> <service> <key>');
  console.log('  dalton-cli configure set <type> <service> <key> <value>');
  console.log('  dalton-cli configure unset <type> <service> [key]');
  console.log(chalk.gray("\n  <type> can be 'ai' or 'mcp'."));
};

/**
 * Validates configuration action type
 * @param type - The action type to validate
 * @returns true if valid, false otherwise
 */
const isValidConfigActionType = (type: string | undefined): type is ConfigActionType => {
  // DEFENSIVE: Validate type is one of the allowed values
  return type === 'ai' || type === 'mcp';
};

/**
 * Validates service name format
 * @param service - The service name to validate
 * @returns true if valid, false otherwise
 */
const isValidServiceName = (service: string | undefined): boolean => {
  // DEFENSIVE: Validate service name type and format
  if (typeof service !== 'string' || service.trim().length === 0) {
    return false;
  }

  // DEFENSIVE: Prevent injection and special characters
  if (service.includes('/') || service.includes('\\') || service.includes('\0')) {
    return false;
  }

  // DEFENSIVE: Limit service name length
  if (service.length > 100) {
    return false;
  }

  return true;
};

/**
 * Validates configuration key format
 * @param key - The configuration key to validate
 * @returns true if valid, false otherwise
 */
const isValidConfigKey = (key: string | undefined): boolean => {
  // DEFENSIVE: Validate key type and format
  if (typeof key !== 'string' || key.trim().length === 0) {
    return false;
  }

  // DEFENSIVE: Prevent injection and special characters
  if (key.includes('/') || key.includes('\\') || key.includes('\0')) {
    return false;
  }

  // DEFENSIVE: Limit key length
  if (key.length > 100) {
    return false;
  }

  return true;
};

/**
 * Main handler for the configure command
 * @param args - Command line arguments [action, type, service, key, value]
 */
const handleConfigure = (args: string[]): void => {
  // DEFENSIVE: Validate args is an array
  if (!Array.isArray(args)) {
    console.error(chalk.red('Error: Invalid arguments provided'));
    printUsage();
    return;
  }

  const [action, type, service, key, value] = args;

  // DEFENSIVE: Validate action is provided
  if (!action || typeof action !== 'string') {
    console.error(chalk.red("Error: Unknown action ''."));
    printUsage();
    return;
  }

  try {
    switch (action) {
      case 'list':
        // DEFENSIVE: Wrap listConfig in try-catch
        try {
          listConfig();
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(chalk.red(`Error listing configuration: ${errorMsg}`));
        }
        break;

      case 'get':
        // DEFENSIVE: Validate all required parameters
        if (!type || typeof type !== 'string' || type === '' || !service || typeof service !== 'string' || service === '' || !key || typeof key !== 'string' || key === '') {
          console.error(chalk.red("Error: 'get' requires a type, service, and key."));
          printUsage();
          return;
        }

        if (!isValidConfigActionType(type)) {
          console.error(chalk.red(`Error: Invalid type '${type}'. Must be 'ai' or 'mcp'.`));
          printUsage();
          return;
        }

        if (!isValidServiceName(service)) {
          console.error(chalk.red(`Error: Invalid service name '${service}'.`));
          return;
        }

        if (!isValidConfigKey(key)) {
          console.error(chalk.red(`Error: Invalid configuration key '${key}'.`));
          return;
        }

        // DEFENSIVE: Wrap getConfigValue in try-catch
        try {
          getConfigValue(type, service, key);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(chalk.red(`Error getting configuration value: ${errorMsg}`));
        }
        break;

      case 'set':
        // DEFENSIVE: Validate all required parameters
        if (!type || typeof type !== 'string' || type === '' || !service || typeof service !== 'string' || service === '' || !key || typeof key !== 'string' || key === '' || value === undefined || value === '') {
          console.error(chalk.red("Error: 'set' requires a type, service, key, and value."));
          printUsage();
          return;
        }

        if (!isValidConfigActionType(type)) {
          console.error(chalk.red(`Error: Invalid type '${type}'. Must be 'ai' or 'mcp'.`));
          printUsage();
          return;
        }

        if (!isValidServiceName(service)) {
          console.error(chalk.red(`Error: Invalid service name '${service}'.`));
          return;
        }

        if (!isValidConfigKey(key)) {
          console.error(chalk.red(`Error: Invalid configuration key '${key}'.`));
          return;
        }

        // DEFENSIVE: Validate value type
        if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
          console.error(chalk.red('Error: Value must be a string, number, or boolean.'));
          return;
        }

        // DEFENSIVE: Wrap setConfigValue in try-catch
        try {
          setConfigValue(type, service, key, value);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(chalk.red(`Error setting configuration value: ${errorMsg}`));
        }
        break;

      case 'unset':
        // DEFENSIVE: Validate required parameters
        if (!type || typeof type !== 'string' || type === '' || !service || typeof service !== 'string' || service === '') {
          console.error(chalk.red("Error: 'unset' requires a type and a service."));
          printUsage();
          return;
        }

        if (!isValidConfigActionType(type)) {
          console.error(chalk.red(`Error: Invalid type '${type}'. Must be 'ai' or 'mcp'.`));
          printUsage();
          return;
        }

        if (!isValidServiceName(service)) {
          console.error(chalk.red(`Error: Invalid service name '${service}'.`));
          return;
        }

        // DEFENSIVE: Validate key if provided
        if (key !== undefined && !isValidConfigKey(key)) {
          console.error(chalk.red(`Error: Invalid configuration key '${key}'.`));
          return;
        }

        // DEFENSIVE: Wrap unsetConfigValue in try-catch
        try {
          unsetConfigValue(type, service, key);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          console.error(chalk.red(`Error unsetting configuration value: ${errorMsg}`));
        }
        break;

      default:
        console.error(chalk.red(`Error: Unknown action '${action}'.`));
        printUsage();
    }
  } catch (error) {
    // DEFENSIVE: Catch any unexpected errors
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(chalk.red(`Unexpected error in configure command: ${errorMsg}`));
  }
};

export default handleConfigure;