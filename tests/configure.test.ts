import chalk from 'chalk';

// Mock chalk first before importing configure
jest.mock('chalk', () => ({
  bold: (text: string) => text,
  red: (text: string) => text,
  green: (text: string) => text,
  yellow: (text: string) => text,
  gray: (text: string) => text,
}));

// Mock the config module before importing configure
jest.mock('../src/core/config', () => ({
  readConfig: jest.fn(),
  setConfigValue: jest.fn(),
  getConfigValue: jest.fn(),
  unsetConfigValue: jest.fn(),
}));

// Import after mocks are set up
import handleConfigure from '../src/commands/configure';
import * as config from '../src/core/config';

describe('Configure Command', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('list action', () => {
    it('should display AI providers and MCP integrations', () => {
      const mockConfig = {
        ai_providers: {
          openai: { api_key: 'test-key' },
          anthropic: { api_key: 'test-key-2' },
        },
        mcp_integrations: {
          github: { token: 'gh-token' },
        },
      };

      (config.readConfig as jest.Mock).mockReturnValue(mockConfig);

      handleConfigure(['list']);

      expect(config.readConfig).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('AI Providers:');
      expect(consoleLogSpy).toHaveBeenCalledWith('- openai');
      expect(consoleLogSpy).toHaveBeenCalledWith('- anthropic');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nMCP Integrations:');
      expect(consoleLogSpy).toHaveBeenCalledWith('- github');
    });

    it('should display (none) when no AI providers are configured', () => {
      const mockConfig = {
        ai_providers: {},
        mcp_integrations: {
          github: { token: 'gh-token' },
        },
      };

      (config.readConfig as jest.Mock).mockReturnValue(mockConfig);

      handleConfigure(['list']);

      expect(consoleLogSpy).toHaveBeenCalledWith('AI Providers:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  (none)');
    });

    it('should display (none) when no MCP integrations are configured', () => {
      const mockConfig = {
        ai_providers: {
          openai: { api_key: 'test-key' },
        },
        mcp_integrations: {},
      };

      (config.readConfig as jest.Mock).mockReturnValue(mockConfig);

      handleConfigure(['list']);

      expect(consoleLogSpy).toHaveBeenCalledWith('\nMCP Integrations:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  (none)');
    });

    it('should handle missing ai_providers and mcp_integrations gracefully', () => {
      const mockConfig = {};

      (config.readConfig as jest.Mock).mockReturnValue(mockConfig);

      handleConfigure(['list']);

      expect(consoleLogSpy).toHaveBeenCalledWith('AI Providers:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  (none)');
      expect(consoleLogSpy).toHaveBeenCalledWith('\nMCP Integrations:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  (none)');
    });

    it('should display multiple providers and integrations correctly', () => {
      const mockConfig = {
        ai_providers: {
          openai: { api_key: 'key1' },
          anthropic: { api_key: 'key2' },
          google: { api_key: 'key3' },
        },
        mcp_integrations: {
          github: { token: 'token1' },
          gitlab: { token: 'token2' },
        },
      };

      (config.readConfig as jest.Mock).mockReturnValue(mockConfig);

      handleConfigure(['list']);

      const logCalls = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(logCalls).toContain('- openai');
      expect(logCalls).toContain('- anthropic');
      expect(logCalls).toContain('- google');
      expect(logCalls).toContain('- github');
      expect(logCalls).toContain('- gitlab');
    });
  });

  describe('get action', () => {
    it('should get config value with valid parameters', () => {
      handleConfigure(['get', 'ai', 'openai', 'api_key']);

      expect(config.getConfigValue).toHaveBeenCalledWith('ai', 'openai', 'api_key');
      expect(config.getConfigValue).toHaveBeenCalledTimes(1);
    });

    it('should get MCP config value with valid parameters', () => {
      handleConfigure(['get', 'mcp', 'github', 'token']);

      expect(config.getConfigValue).toHaveBeenCalledWith('mcp', 'github', 'token');
      expect(config.getConfigValue).toHaveBeenCalledTimes(1);
    });

    it('should error when type is missing', () => {
      handleConfigure(['get', '', 'openai', 'api_key']);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: 'get' requires a type, service, and key.");
      expect(config.getConfigValue).not.toHaveBeenCalled();
    });

    it('should error when service is missing', () => {
      handleConfigure(['get', 'ai', '', 'api_key']);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: 'get' requires a type, service, and key.");
      expect(config.getConfigValue).not.toHaveBeenCalled();
    });

    it('should error when key is missing', () => {
      handleConfigure(['get', 'ai', 'openai', '']);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: 'get' requires a type, service, and key.");
      expect(config.getConfigValue).not.toHaveBeenCalled();
    });

    it('should error when type is undefined', () => {
      handleConfigure(['get']);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: 'get' requires a type, service, and key.");
      expect(config.getConfigValue).not.toHaveBeenCalled();
    });

    it('should print usage when required arguments are missing', () => {
      handleConfigure(['get', 'ai']);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Usage:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  dalton-cli configure list');
      expect(consoleLogSpy).toHaveBeenCalledWith('  dalton-cli configure get <type> <service> <key>');
    });
  });

  describe('set action', () => {
    it('should set config value with valid parameters', () => {
      handleConfigure(['set', 'ai', 'openai', 'api_key', 'sk-1234567890']);

      expect(config.setConfigValue).toHaveBeenCalledWith('ai', 'openai', 'api_key', 'sk-1234567890');
      expect(config.setConfigValue).toHaveBeenCalledTimes(1);
    });

    it('should set MCP config value with valid parameters', () => {
      handleConfigure(['set', 'mcp', 'github', 'token', 'ghp_1234567890']);

      expect(config.setConfigValue).toHaveBeenCalledWith('mcp', 'github', 'token', 'ghp_1234567890');
      expect(config.setConfigValue).toHaveBeenCalledTimes(1);
    });

    it('should handle values with special characters', () => {
      const specialValue = 'sk-proj-abc123!@#$%^&*()_+=-[]{}|;:,.<>?';
      handleConfigure(['set', 'ai', 'openai', 'api_key', specialValue]);

      expect(config.setConfigValue).toHaveBeenCalledWith('ai', 'openai', 'api_key', specialValue);
    });

    it('should error when type is missing', () => {
      handleConfigure(['set', '', 'openai', 'api_key', 'value']);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: 'set' requires a type, service, key, and value.");
      expect(config.setConfigValue).not.toHaveBeenCalled();
    });

    it('should error when service is missing', () => {
      handleConfigure(['set', 'ai', '', 'api_key', 'value']);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: 'set' requires a type, service, key, and value.");
      expect(config.setConfigValue).not.toHaveBeenCalled();
    });

    it('should error when key is missing', () => {
      handleConfigure(['set', 'ai', 'openai', '', 'value']);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: 'set' requires a type, service, key, and value.");
      expect(config.setConfigValue).not.toHaveBeenCalled();
    });

    it('should error when value is missing', () => {
      handleConfigure(['set', 'ai', 'openai', 'api_key', '']);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: 'set' requires a type, service, key, and value.");
      expect(config.setConfigValue).not.toHaveBeenCalled();
    });

    it('should error when value is undefined', () => {
      handleConfigure(['set', 'ai', 'openai', 'api_key']);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: 'set' requires a type, service, key, and value.");
      expect(config.setConfigValue).not.toHaveBeenCalled();
    });

    it('should print usage when required arguments are missing', () => {
      handleConfigure(['set', 'ai', 'openai', 'api_key']);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Usage:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  dalton-cli configure set <type> <service> <key> <value>');
    });
  });

  describe('unset action', () => {
    it('should unset specific config value with key parameter', () => {
      handleConfigure(['unset', 'ai', 'openai', 'api_key']);

      expect(config.unsetConfigValue).toHaveBeenCalledWith('ai', 'openai', 'api_key');
      expect(config.unsetConfigValue).toHaveBeenCalledTimes(1);
    });

    it('should unset entire service config when key is not provided', () => {
      handleConfigure(['unset', 'ai', 'openai']);

      expect(config.unsetConfigValue).toHaveBeenCalledWith('ai', 'openai', undefined);
      expect(config.unsetConfigValue).toHaveBeenCalledTimes(1);
    });

    it('should unset MCP integration with key', () => {
      handleConfigure(['unset', 'mcp', 'github', 'token']);

      expect(config.unsetConfigValue).toHaveBeenCalledWith('mcp', 'github', 'token');
    });

    it('should unset entire MCP integration without key', () => {
      handleConfigure(['unset', 'mcp', 'github']);

      expect(config.unsetConfigValue).toHaveBeenCalledWith('mcp', 'github', undefined);
    });

    it('should error when type is missing', () => {
      handleConfigure(['unset', '', 'openai']);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: 'unset' requires a type and a service.");
      expect(config.unsetConfigValue).not.toHaveBeenCalled();
    });

    it('should error when service is missing', () => {
      handleConfigure(['unset', 'ai', '']);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: 'unset' requires a type and a service.");
      expect(config.unsetConfigValue).not.toHaveBeenCalled();
    });

    it('should error when only action is provided', () => {
      handleConfigure(['unset']);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: 'unset' requires a type and a service.");
      expect(config.unsetConfigValue).not.toHaveBeenCalled();
    });

    it('should print usage when required arguments are missing', () => {
      handleConfigure(['unset', 'ai']);

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('Usage:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  dalton-cli configure unset <type> <service> [key]');
    });

    it('should allow unset with optional key parameter', () => {
      handleConfigure(['unset', 'ai', 'openai', 'optional_key']);

      expect(config.unsetConfigValue).toHaveBeenCalledWith('ai', 'openai', 'optional_key');
    });
  });

  describe('invalid action', () => {
    it('should error on unknown action', () => {
      handleConfigure(['invalid']);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Unknown action 'invalid'.");
    });

    it('should print usage on unknown action', () => {
      handleConfigure(['delete']);

      expect(consoleLogSpy).toHaveBeenCalledWith('Usage:');
      expect(consoleLogSpy).toHaveBeenCalledWith('  dalton-cli configure list');
      expect(consoleLogSpy).toHaveBeenCalledWith('  dalton-cli configure get <type> <service> <key>');
      expect(consoleLogSpy).toHaveBeenCalledWith('  dalton-cli configure set <type> <service> <key> <value>');
      expect(consoleLogSpy).toHaveBeenCalledWith('  dalton-cli configure unset <type> <service> [key]');
    });

    it('should error when action is empty string', () => {
      handleConfigure(['']);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Unknown action ''.");
    });

    it('should error when no action is provided', () => {
      handleConfigure([]);

      expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Unknown action ''.");
    });

    it('should display type hint in usage', () => {
      handleConfigure(['unknown_command']);

      const logCalls = consoleLogSpy.mock.calls.map((call) => call[0]);
      const hasTypeHint = logCalls.some((call) => call.includes("<type> can be 'ai' or 'mcp'."));
      expect(hasTypeHint).toBe(true);
    });
  });

  describe('edge cases and special scenarios', () => {
    it('should handle extra arguments after valid parameters', () => {
      handleConfigure(['set', 'ai', 'openai', 'api_key', 'value', 'extra1', 'extra2']);

      // Should only use the first 5 arguments and ignore extra ones
      expect(config.setConfigValue).toHaveBeenCalledWith('ai', 'openai', 'api_key', 'value');
    });

    it('should handle whitespace in values', () => {
      handleConfigure(['set', 'ai', 'openai', 'api_key', 'sk-1234 5678 9012']);

      expect(config.setConfigValue).toHaveBeenCalledWith('ai', 'openai', 'api_key', 'sk-1234 5678 9012');
    });

    it('should handle numeric values as strings', () => {
      handleConfigure(['set', 'ai', 'openai', 'max_tokens', '4096']);

      expect(config.setConfigValue).toHaveBeenCalledWith('ai', 'openai', 'max_tokens', '4096');
    });

    it('should handle get action with all config functions not called', () => {
      handleConfigure(['get', 'ai', 'openai', 'api_key']);

      expect(config.readConfig).not.toHaveBeenCalled();
      expect(config.setConfigValue).not.toHaveBeenCalled();
      expect(config.unsetConfigValue).not.toHaveBeenCalled();
    });

    it('should handle set action with only config functions called', () => {
      handleConfigure(['set', 'ai', 'openai', 'api_key', 'value']);

      expect(config.readConfig).not.toHaveBeenCalled();
      expect(config.getConfigValue).not.toHaveBeenCalled();
      expect(config.unsetConfigValue).not.toHaveBeenCalled();
    });

    it('should handle unset action with all parameters provided', () => {
      handleConfigure(['unset', 'mcp', 'github', 'token', 'extra']);

      // Should pass 'token' as the key, ignoring 'extra'
      expect(config.unsetConfigValue).toHaveBeenCalledWith('mcp', 'github', 'token');
    });
  });

  describe('console output and error messages', () => {
    it('should display usage information with all commands', () => {
      handleConfigure(['help']);

      const logCalls = consoleLogSpy.mock.calls.map((call) => call[0]);
      expect(logCalls).toContain('Usage:');
      expect(logCalls.some((call) => call.includes('list')));
      expect(logCalls.some((call) => call.includes('get')));
      expect(logCalls.some((call) => call.includes('set')));
      expect(logCalls.some((call) => call.includes('unset')));
    });

    it('should display type hint information', () => {
      handleConfigure(['unknown']);

      const logCalls = consoleLogSpy.mock.calls.map((call) => call[0]);
      const hasTypeHint = logCalls.some((call) => call.includes("<type> can be 'ai' or 'mcp'."));
      expect(hasTypeHint).toBe(true);
    });

    it('should format error messages with action name', () => {
      handleConfigure(['get', 'ai']);

      const errorMessages = consoleErrorSpy.mock.calls.map((call) => call[0]);
      expect(errorMessages.some((msg) => msg.includes('get')));
    });

    it('should handle list action without calling other config functions', () => {
      const mockConfig = { ai_providers: {}, mcp_integrations: {} };
      (config.readConfig as jest.Mock).mockReturnValue(mockConfig);

      handleConfigure(['list']);

      expect(config.getConfigValue).not.toHaveBeenCalled();
      expect(config.setConfigValue).not.toHaveBeenCalled();
      expect(config.unsetConfigValue).not.toHaveBeenCalled();
    });
  });

  describe('type casting and parameter handling', () => {
    it('should cast type parameter as ConfigActionType for get', () => {
      handleConfigure(['get', 'ai', 'openai', 'api_key']);

      const callArgs = (config.getConfigValue as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe('ai');
      expect(typeof callArgs[0]).toBe('string');
    });

    it('should cast type parameter as ConfigActionType for set', () => {
      handleConfigure(['set', 'mcp', 'github', 'token', 'value']);

      const callArgs = (config.setConfigValue as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe('mcp');
      expect(typeof callArgs[0]).toBe('string');
    });

    it('should cast type parameter as ConfigActionType for unset', () => {
      handleConfigure(['unset', 'ai', 'openai', 'key']);

      const callArgs = (config.unsetConfigValue as jest.Mock).mock.calls[0];
      expect(callArgs[0]).toBe('ai');
      expect(typeof callArgs[0]).toBe('string');
    });

    it('should pass service name as string parameter', () => {
      handleConfigure(['get', 'ai', 'openai', 'key']);

      const callArgs = (config.getConfigValue as jest.Mock).mock.calls[0];
      expect(callArgs[1]).toBe('openai');
      expect(typeof callArgs[1]).toBe('string');
    });

    it('should pass key parameter correctly for all actions', () => {
      handleConfigure(['get', 'ai', 'openai', 'my_key']);
      let callArgs = (config.getConfigValue as jest.Mock).mock.calls[0];
      expect(callArgs[2]).toBe('my_key');

      jest.clearAllMocks();

      handleConfigure(['set', 'ai', 'openai', 'my_key', 'value']);
      callArgs = (config.setConfigValue as jest.Mock).mock.calls[0];
      expect(callArgs[2]).toBe('my_key');

      jest.clearAllMocks();

      handleConfigure(['unset', 'ai', 'openai', 'my_key']);
      callArgs = (config.unsetConfigValue as jest.Mock).mock.calls[0];
      expect(callArgs[2]).toBe('my_key');
    });
  });
});
