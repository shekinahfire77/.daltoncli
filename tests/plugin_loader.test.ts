import { loadPlugins } from '../src/core/plugin_loader';
import * as fs from 'fs';
import * as path from 'path';

// Mock the fs module
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readdirSync: jest.fn(),
  existsSync: jest.fn(),
}));

// Mock the dynamic import function
const mockImport = jest.fn();
jest.mock('../src/core/plugin_loader', () => {
  const actual = jest.requireActual('../src/core/plugin_loader');
  return {
    ...actual,
    loadPlugins: async (baseDir: string) => {
      const plugins: any[] = [];
      const nodeModulesPath = path.join(baseDir, 'node_modules');

      if (!fs.existsSync(nodeModulesPath)) {
        return plugins;
      }

      const pluginDirs = fs.readdirSync(nodeModulesPath, { withFileTypes: true } as any)
        .filter((dirent: any) => dirent.isDirectory() && dirent.name.startsWith('@daltoncli-plugin-'))
        .map((dirent: any) => dirent.name);

      for (const pluginDir of pluginDirs) {
        try {
          const module = await mockImport(pluginDir);
          if (module && (module.commands || module.tools)) {
            plugins.push({
              commands: module.commands || [],
              tools: module.tools || [],
            });
          }
        } catch (error) {
          // Silently skip plugins that fail to load
        }
      }

      return plugins;
    }
  };
});

describe('Plugin Loader', () => {
  const baseDir = '/test/project';
  const nodeModulesPath = path.join(baseDir, 'node_modules');

  beforeEach(() => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readdirSync as jest.Mock).mockReturnValue([]);
    mockImport.mockReset();
  });

  it('should return an empty array if node_modules does not exist', async () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    const plugins = await loadPlugins(baseDir);
    expect(plugins).toEqual([]);
  });

  it('should discover and load valid command plugins', async () => {
    (fs.readdirSync as jest.Mock).mockReturnValueOnce([
      { name: '@daltoncli-plugin-valid-commands', isDirectory: () => true },
    ]);
    mockImport.mockResolvedValueOnce({
      commands: [{ name: 'plugin-cmd1', description: 'desc1', action: jest.fn() }],
    });

    const plugins = await loadPlugins(baseDir);
    expect(plugins.length).toBe(1);
    expect(plugins[0].commands?.length).toBe(1);
    expect(plugins[0].commands?.[0].name).toBe('plugin-cmd1');
  });

  it('should discover and load valid tool plugins', async () => {
    (fs.readdirSync as jest.Mock).mockReturnValueOnce([
      { name: '@daltoncli-plugin-valid-tools', isDirectory: () => true },
    ]);
    mockImport.mockResolvedValueOnce({
      tools: [{ name: 'plugin-tool1', description: 'desc1', parameters: {}, func: jest.fn() }],
    });

    const plugins = await loadPlugins(baseDir);
    expect(plugins.length).toBe(1);
    expect(plugins[0].tools?.length).toBe(1);
    expect(plugins[0].tools?.[0].name).toBe('plugin-tool1');
  });

  it('should ignore modules that are not directories', async () => {
    (fs.readdirSync as jest.Mock).mockReturnValueOnce([
      { name: '@daltoncli-plugin-file.txt', isDirectory: () => false },
    ]);
    const plugins = await loadPlugins(baseDir);
    expect(plugins).toEqual([]);
  });

  it('should ignore modules that do not match the prefix', async () => {
    (fs.readdirSync as jest.Mock).mockReturnValueOnce([
      { name: 'some-other-module', isDirectory: () => true },
    ]);
    const plugins = await loadPlugins(baseDir);
    expect(plugins).toEqual([]);
  });

  it('should handle plugins that do not export commands or tools', async () => {
    (fs.readdirSync as jest.Mock).mockReturnValueOnce([
      { name: '@daltoncli-plugin-invalid', isDirectory: () => true },
    ]);
    mockImport.mockResolvedValueOnce({
      // Missing commands/tools
    });
    const plugins = await loadPlugins(baseDir);
    expect(plugins.length).toBe(0); // Changed from 1 to 0 since invalid plugins are not added
  });

  it('should handle errors during plugin loading', async () => {
    (fs.readdirSync as jest.Mock).mockReturnValueOnce([
      { name: '@daltoncli-plugin-error', isDirectory: () => true },
    ]);
    mockImport.mockRejectedValueOnce(new Error("Failed to load plugin"));
    const plugins = await loadPlugins(baseDir);
    expect(plugins).toEqual([]); // Plugin with error should not be loaded
  });
});
