import * as fs from 'fs';
import * as path from 'path';
import { DaltonCLIPlugin } from './plugin_types';

/**
 * Standard prefix for Dalton CLI plugins in node_modules
 */
const PLUGIN_PREFIX = '@daltoncli-plugin-';

/**
 * Custom error class for plugin loading errors
 */
class PluginLoadError extends Error {
  constructor(message: string, public pluginName?: string, public cause?: Error) {
    super(message);
    this.name = 'PluginLoadError';
  }
}

/**
 * Validates base directory path
 * @param baseDir - The directory path to validate
 * @returns true if valid, false otherwise
 */
const isValidBaseDir = (baseDir: string): boolean => {
  // DEFENSIVE: Validate baseDir type
  if (typeof baseDir !== 'string' || baseDir.trim().length === 0) {
    return false;
  }

  // DEFENSIVE: Check for null bytes and control characters
  if (baseDir.includes('\0') || baseDir.includes('\r') || baseDir.includes('\n')) {
    return false;
  }

  return true;
};

/**
 * Validates plugin module structure
 * @param module - The module to validate
 * @returns true if valid plugin structure, false otherwise
 */
const isValidPluginModule = (module: unknown): boolean => {
  // DEFENSIVE: Validate module is an object
  if (!module || typeof module !== 'object') {
    return false;
  }

  // DEFENSIVE: Check that module has at least commands or tools
  const mod = module as Record<string, unknown>;
  const hasCommands = 'commands' in mod && Array.isArray(mod.commands);
  const hasTools = 'tools' in mod && Array.isArray(mod.tools);

  return hasCommands || hasTools;
};

/**
 * Validates plugin name format
 * @param pluginName - The plugin name to validate
 * @returns true if valid, false otherwise
 */
const isValidPluginName = (pluginName: string): boolean => {
  // DEFENSIVE: Validate plugin name type
  if (typeof pluginName !== 'string' || pluginName.trim().length === 0) {
    return false;
  }

  // DEFENSIVE: Ensure plugin name starts with valid prefix
  if (!pluginName.startsWith(PLUGIN_PREFIX)) {
    return false;
  }

  // DEFENSIVE: Check for path traversal attempts
  if (pluginName.includes('..') || pluginName.includes('/') || pluginName.includes('\\')) {
    return false;
  }

  return true;
};

/**
 * Dynamically loads and registers plugins from node_modules
 * Discovers plugins with the @daltoncli-plugin- prefix and loads their commands and tools
 * @param baseDir - The base directory to search for node_modules (typically process.cwd())
 * @returns An array of loaded DaltonCLIPlugin instances
 */
export async function loadPlugins(baseDir: string): Promise<DaltonCLIPlugin[]> {
  const plugins: DaltonCLIPlugin[] = [];

  // DEFENSIVE: Validate baseDir parameter
  if (!isValidBaseDir(baseDir)) {
    throw new PluginLoadError('Invalid base directory path provided');
  }

  let nodeModulesPath: string;
  try {
    nodeModulesPath = path.join(baseDir, 'node_modules');
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new PluginLoadError(`Failed to construct node_modules path: ${errorMsg}`);
  }

  // DEFENSIVE: Check if node_modules exists
  try {
    if (!fs.existsSync(nodeModulesPath)) {
      console.warn('node_modules directory not found. No plugins will be loaded.');
      return plugins;
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new PluginLoadError(`Failed to check node_modules existence: ${errorMsg}`);
  }

  // DEFENSIVE: Read directory with error handling
  let pluginDirs: string[];
  try {
    const dirents = fs.readdirSync(nodeModulesPath, { withFileTypes: true });
    pluginDirs = dirents
      .filter(dirent => {
        // DEFENSIVE: Validate dirent structure
        if (!dirent || typeof dirent.name !== 'string') {
          return false;
        }
        return dirent.isDirectory() && dirent.name.startsWith(PLUGIN_PREFIX);
      })
      .map(dirent => dirent.name);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    throw new PluginLoadError(`Failed to read node_modules directory: ${errorMsg}`);
  }

  // DEFENSIVE: Load each plugin with error handling
  for (const pluginDir of pluginDirs) {
    // DEFENSIVE: Validate plugin name before loading
    if (!isValidPluginName(pluginDir)) {
      console.warn(`Skipping invalid plugin name: ${pluginDir}`);
      continue;
    }

    try {
      let pluginPath: string;
      try {
        pluginPath = path.join(nodeModulesPath, pluginDir);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to construct path for plugin ${pluginDir}: ${errorMsg}`);
        continue;
      }

      // DEFENSIVE: Import plugin module with error handling
      let module: unknown;
      try {
        module = await import(pluginPath);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to import plugin ${pluginDir}: ${errorMsg}`);
        continue;
      }

      // DEFENSIVE: Validate plugin module structure
      if (!isValidPluginModule(module)) {
        console.warn(`Plugin ${pluginDir} does not export valid commands or tools.`);
        continue;
      }

      // DEFENSIVE: Extract and validate plugin components
      const mod = module as { commands?: unknown[]; tools?: unknown[] };
      const commands = Array.isArray(mod.commands) ? mod.commands as DaltonCLIPlugin['commands'] : [];
      const tools = Array.isArray(mod.tools) ? mod.tools as DaltonCLIPlugin['tools'] : [];

      plugins.push({
        commands,
        tools,
      });

      console.log(`Loaded plugin: ${pluginDir} (${commands?.length || 0} commands, ${tools?.length || 0} tools)`);
    } catch (error) {
      // DEFENSIVE: Catch any unexpected errors during plugin loading
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Unexpected error loading plugin ${pluginDir}: ${errorMsg}`);
      // Continue loading other plugins despite errors
    }
  }

  return plugins;
}
