
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { z } from 'zod';
import { aiConfigSchema } from './schemas';

const APP_DATA_DIR = path.join(os.homedir(), '.dalton-cli');
const configPath = path.join(APP_DATA_DIR, 'config.json');

// Infer types from schemas
export type AIConfig = z.infer<typeof aiConfigSchema>;

// Define the main config type
const configSchema = z.object({
  ai_providers: aiConfigSchema.optional(),
  mcp_integrations: z.record(z.any()).optional(), // Keeping mcp_integrations flexible for now
});

export type AppConfig = z.infer<typeof configSchema>;

export const readConfig = (): AppConfig => {
  try {
    if (!fs.existsSync(configPath)) {
      if (!fs.existsSync(APP_DATA_DIR)) fs.mkdirSync(APP_DATA_DIR, { recursive: true });
      const defaultConfig: AppConfig = { ai_providers: {}, mcp_integrations: {} };
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      return defaultConfig;
    }
    const rawData = fs.readFileSync(configPath, 'utf-8');
    const jsonData = JSON.parse(rawData);
    return configSchema.parse(jsonData);
  } catch (error) {
    console.error(chalk.red('Error reading or parsing config file:'), error);
    return { ai_providers: {}, mcp_integrations: {} };
  }
};

export const writeConfig = (config: AppConfig): void => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  } catch (error) {
    console.error(chalk.red('Error writing to config file:'), error);
  }
};

export const getConfigValue = (type: 'ai' | 'mcp', service: string, key: string): void => {
  const config = readConfig();
  const category = type === 'ai' ? 'ai_providers' : 'mcp_integrations';
  const value = config[category]?.[service]?.[key];
  if (value) {
    console.log(`${type}.${service}.${key} = ${value}`);
  } else {
    console.log(chalk.yellow(`Value for ${type}.${service}.${key} not found.`));
  }
};

export const setConfigValue = (type: 'ai' | 'mcp', service: string, key: string, value: any): void => {
  const config = readConfig();
  const category = type === 'ai' ? 'ai_providers' : 'mcp_integrations';
  if (!config[category]) config[category] = {};
  if (!config[category][service]) config[category][service] = {};
  config[category][service][key] = value;
  writeConfig(config);
  console.log(chalk.green(`Configuration updated for ${service}.`));
};

export const unsetConfigValue = (type: 'ai' | 'mcp', service: string, key?: string): void => {
  const config = readConfig();
  const category = type === 'ai' ? 'ai_providers' : 'mcp_integrations';
  if (key) {
    if (config[category]?.[service]?.[key]) {
      delete config[category][service][key];
      console.log(chalk.green(`Unset ${type}.${service}.${key}`));
    }
     else {
      console.log(chalk.yellow(`Value for ${type}.${service}.${key} not found.`));
    }
  } else if (service) {
    if (config[category]?.[service]) {
      delete config[category][service];
      console.log(chalk.green(`Unset all configurations for ${type}.${service}`));
    }
  }
  writeConfig(config);
};
