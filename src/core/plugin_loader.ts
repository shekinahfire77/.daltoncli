import * as fs from 'fs';
import * as path from 'path';
import { DaltonCLIPlugin } from './plugin_types';

const PLUGIN_PREFIX = '@daltoncli-plugin-';

export async function loadPlugins(baseDir: string): Promise<DaltonCLIPlugin[]> {
  const plugins: DaltonCLIPlugin[] = [];
  const nodeModulesPath = path.join(baseDir, 'node_modules');

  if (!fs.existsSync(nodeModulesPath)) {
    console.warn('node_modules directory not found. No plugins will be loaded.');
    return plugins;
  }

  const pluginDirs = fs.readdirSync(nodeModulesPath, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory() && dirent.name.startsWith(PLUGIN_PREFIX))
    .map(dirent => dirent.name);

  for (const pluginDir of pluginDirs) {
    try {
      const pluginPath = path.join(nodeModulesPath, pluginDir);
      // Dynamic import for ESM modules
      const module = await import(pluginPath);
      
      // Basic validation that the module exports what we expect
      if (module && (module.commands || module.tools)) {
        plugins.push({
          commands: module.commands || [],
          tools: module.tools || [],
        });
        console.log(`Loaded plugin: ${pluginDir}`);
      } else {
        console.warn(`Plugin ${pluginDir} does not export commands or tools.`);
      }
    } catch (error) {
      console.error(`Failed to load plugin ${pluginDir}:`, error);
    }
  }

  return plugins;
}
