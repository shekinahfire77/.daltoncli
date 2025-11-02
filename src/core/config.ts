import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import chalk from 'chalk';
import { z } from 'zod';
import { aiConfigSchema, McpIntegrationsSchema } from './schemas';

// Prefer repo config.json in development, fall back to APP_DATA_DIR
const APP_DATA_DIR = path.join(os.homedir(), '.dalton-cli');
const configPath = path.join(process.cwd(), 'config.json');

// Infer types from schemas
export type AIConfig = z.infer<typeof aiConfigSchema>;
export type McpIntegrationsConfig = z.infer<typeof McpIntegrationsSchema>;

// Define the main config type
const configSchema = z.object({
  ai_providers: aiConfigSchema.optional(),
  mcp_integrations: McpIntegrationsSchema.optional(),
});

export type AppConfig = z.infer<typeof configSchema>;

type ConfigValue = string | number | boolean;

// Safe JSON parsing function to prevent prototype pollution and injection attacks
const safeJsonParse = (jsonString: string): Record<string, unknown> => {
  try {
    return JSON.parse(jsonString, (key, value) => {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        return undefined;
      }
      return value;
    });
  } catch (error) {
    throw new Error(`Invalid JSON format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const readConfig = (): AppConfig => {
  try {
    if (!fs.existsSync(configPath)) {
      // Fall back to distributed config location if present
      const fallback = path.join(__dirname, '..', '..', 'config.json');
      if (!fs.existsSync(fallback)) {
        console.error(chalk.red(`Error: config.json not found at ${configPath} or ${fallback}. Please ensure it's present.`));
        // Return a minimal valid shape so callers don't crash
        return { ai_providers: {}, mcp_integrations: { enabled: false } } as AppConfig;
      }
    }

    const raw = fs.readFileSync(fs.existsSync(configPath) ? configPath : path.join(__dirname, '..', '..', 'config.json'), 'utf8');
    const parsed = safeJsonParse(raw);
    return configSchema.parse(parsed);
  } catch (err) {
    console.error(chalk.red('Error reading/parsing config:'), err);
    return { ai_providers: {}, mcp_integrations: { enabled: false } } as AppConfig;
  }
};

export const writeConfig = (config: AppConfig): void => {
  try {
    // Ensure parent dir exists for configPath
    try {
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      // ignore
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error(chalk.red('Error writing to config:'), err);
  }
};

export const getConfigValue = (type: 'ai' | 'mcp', service: string, key: string): ConfigValue | undefined => {
  const config = readConfig();
  if (type === 'ai') {
    const svc = config.ai_providers?.[service] as unknown as Record<string, ConfigValue> | undefined;
    const v = svc?.[key];
    if (v === undefined) console.log(chalk.yellow(`Value for ai.${service}.${key} not found.`));
    else console.log(`${type}.${service}.${key} = ${v}`);
    return v;
  }

  // mcp
  const mcp = config.mcp_integrations as unknown as Record<string, any> | undefined;
  // try direct property
  if (mcp && (mcp as any)[service] && typeof (mcp as any)[service] === 'object') {
    const v = (mcp as any)[service][key] as ConfigValue | undefined;
    if (v === undefined) console.log(chalk.yellow(`Value for mcp.${service}.${key} not found.`));
    else console.log(`${type}.${service}.${key} = ${v}`);
    return v;
  }

  console.log(chalk.yellow(`Value for ${type}.${service}.${key} not found.`));
  return undefined;
};

export const setConfigValue = (type: 'ai' | 'mcp', service: string, key: string, value: ConfigValue): void => {
  const config = readConfig();
  if (type === 'ai') {
    config.ai_providers = config.ai_providers || {};
    config.ai_providers[service] = config.ai_providers[service] || ({} as any);
    (config.ai_providers[service] as any)[key] = value;
  } else {
    config.mcp_integrations = config.mcp_integrations || ({ enabled: false } as any);
    // set on a named server if present
    if (Array.isArray((config.mcp_integrations as any).servers)) {
      const server = (config.mcp_integrations as any).servers.find((s: any) => s.name === service);
      if (server) {
        server[key] = value;
      } else {
        // fallback: set top-level property on mcp_integrations
        (config.mcp_integrations as any)[service] = (config.mcp_integrations as any)[service] || value;
      }
    } else {
      (config.mcp_integrations as any)[service] = (config.mcp_integrations as any)[service] || value;
    }
  }
  writeConfig(config);
  console.log(chalk.green(`Configuration updated for ${service}.`));
};

export const unsetConfigValue = (type: 'ai' | 'mcp', service: string, key?: string): void => {
  const config = readConfig();
  if (type === 'ai') {
    if (!config.ai_providers) return;
    if (!key) {
      delete config.ai_providers[service];
      console.log(chalk.green(`Unset all configurations for ai.${service}`));
      writeConfig(config);
      return;
    }
    if (config.ai_providers[service]) {
      delete (config.ai_providers[service] as any)[key];
      console.log(chalk.green(`Unset ai.${service}.${key}`));
    }
    writeConfig(config);
    return;
  }

  // mcp
  if (!config.mcp_integrations) return;
  if (!key) {
    // try remove server by name
    if (Array.isArray((config.mcp_integrations as any).servers)) {
      const idx = (config.mcp_integrations as any).servers.findIndex((s: any) => s.name === service);
      if (idx !== -1) {
        (config.mcp_integrations as any).servers.splice(idx, 1);
        console.log(chalk.green(`Removed MCP server ${service}`));
        writeConfig(config);
        return;
      }
    }
    // otherwise remove property
    if ((config.mcp_integrations as any)[service] !== undefined) {
      delete (config.mcp_integrations as any)[service];
      console.log(chalk.green(`Unset mcp.${service}`));
      writeConfig(config);
      return;
    }
    return;
  }

  // unset mcp property on server if exists
  if (Array.isArray((config.mcp_integrations as any).servers)) {
    const server = (config.mcp_integrations as any).servers.find((s: any) => s.name === service);
    if (server && server[key] !== undefined) {
      delete server[key];
      console.log(chalk.green(`Unset mcp.${service}.${key}`));
      writeConfig(config);
      return;
    }
  }
  // fallback
  if ((config.mcp_integrations as any)[service] && (config.mcp_integrations as any)[service][key] !== undefined) {
    delete (config.mcp_integrations as any)[service][key];
    console.log(chalk.green(`Unset mcp.${service}.${key}`));
    writeConfig(config);
  }
};
