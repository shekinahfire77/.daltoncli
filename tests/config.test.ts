import { config, getApiKey } from '../src/config';
import { ProviderConfigSchema } from '../src/core/schemas';

describe('Configuration Validation', () => {
  it('should load valid configuration without errors', () => {
    // The config module has already been loaded, so we just verify it's valid
    expect(config).toBeDefined();
    expect(config.name).toBeDefined();
    expect(typeof config.name).toBe('string');
  });

  it('should have required fields', () => {
    expect(config.name).toBeDefined();
    expect(config.apiKey).toBeDefined();
    expect(config.defaultModel).toBeDefined();
    expect(config.elevatedModel).toBeDefined();
    expect(config.defaultChatModel).toBeDefined();
  });

  it('should validate config against schema', () => {
    // Test that the schema validates a correct config
    const validConfig = {
      name: 'openai',
      apiKey: 'test-key',
      defaultModel: 'gpt-4o',
      elevatedModel: 'gpt-4o',
      defaultChatModel: 'gpt-3.5-turbo',
    };
    const result = ProviderConfigSchema.safeParse(validConfig);
    expect(result.success).toBe(true);
  });

  it('should reject invalid config with unknown keys', () => {
    const invalidConfig = {
      name: 'openai',
      apiKey: 'test-key',
      defaultModel: 'gpt-4o',
      elevatedModel: 'gpt-4o',
      defaultChatModel: 'gpt-3.5-turbo',
      unknownKey: 'someValue',
    };
    const result = ProviderConfigSchema.safeParse(invalidConfig);
    expect(result.success).toBe(false);
  });

  it('should have a working getApiKey function', () => {
    const apiKey = getApiKey(config.name);
    expect(typeof apiKey).toBe('string');
  });
});
