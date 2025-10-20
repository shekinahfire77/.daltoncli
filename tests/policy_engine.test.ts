import { determineModel, validateToolCall } from '../src/core/policy_engine';
import { ChatMessage, ModelRegistry } from '../src/core/schemas';
import { config } from '../src/config';

// Mock config for testing purposes
jest.mock('../src/config', () => ({
  config: {
    elevatedModel: 'gpt-4o',
    defaultChatModel: 'gpt-3.5-turbo',
  },
}));

describe('Policy Engine', () => {
  const mockModelRegistry: ModelRegistry = {
    'gpt-3.5-turbo': { provider: 'openai', modelId: 'gpt-3.5-turbo' },
    'gpt-4o': { provider: 'openai', modelId: 'gpt-4o' },
    'mistral-small': { provider: 'mistralai', modelId: 'mistral-small' },
  };

  describe('determineModel', () => {
    it('should return forceModel if provided', () => {
      const message: ChatMessage = { role: 'user', content: 'Any content' };
      const model = determineModel(message, mockModelRegistry, { forceModel: 'mistral-small' });
      expect(model).toBe('mistral-small');
    });

    it('should elevate model for large code blocks', () => {
      const message: ChatMessage = { role: 'user', content: '```javascript\nline1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\nline11\n```' };
      const model = determineModel(message, mockModelRegistry);
      expect(model).toBe(config.elevatedModel);
    });

    it('should use default chat model for small code blocks or no code', () => {
      const message1: ChatMessage = { role: 'user', content: '```javascript\nline1\n```' };
      const model1 = determineModel(message1, mockModelRegistry);
      expect(model1).toBe(config.defaultChatModel);

      const message2: ChatMessage = { role: 'user', content: 'Just a regular chat message.' };
      const model2 = determineModel(message2, mockModelRegistry);
      expect(model2).toBe(config.defaultChatModel);
    });

    it('should fallback to first available model if default/elevated not in registry', () => {
      const customModelRegistry: ModelRegistry = {
        'my-custom-model': { provider: 'custom', modelId: 'custom-id' },
      };
      // Temporarily mock config to point to non-existent models
      const originalConfig = { ...config };
      (config as any).elevatedModel = 'non-existent';
      (config as any).defaultChatModel = 'non-existent';

      const message: ChatMessage = { role: 'user', content: 'Any content' };
      const model = determineModel(message, customModelRegistry);
      expect(model).toBe('my-custom-model');

      // Restore original config
      Object.assign(config, originalConfig);
    });

    it('should throw error if no suitable model found', () => {
      const emptyModelRegistry: ModelRegistry = {};
      const message: ChatMessage = { role: 'user', content: 'Any content' };
      expect(() => determineModel(message, emptyModelRegistry)).toThrow("No suitable model found in registry.");
    });
  });

  describe('validateToolCall', () => {
    const RATIONALE_PHRASE = 'I am requesting a tool call to';

    it('should return true if no tool calls are present', () => {
      const message: ChatMessage = { role: 'assistant', content: 'No tool call here.' };
      expect(validateToolCall(message)).toBe(true);
    });

    it('should return false if tool calls are present but no content', () => {
      const message: ChatMessage = { role: 'assistant', tool_calls: [{ id: '1', function: { name: 'tool', arguments: '{}' } }] };
      expect(validateToolCall(message)).toBe(false);
    });

    it('should return true if tool calls are present and rationale is included', () => {
      const message: ChatMessage = { role: 'assistant', content: `${RATIONALE_PHRASE} do something.`, tool_calls: [{ id: '1', function: { name: 'tool', arguments: '{}' } }] };
      expect(validateToolCall(message)).toBe(true);
    });

    it('should return false if tool calls are present but rationale is missing', () => {
      const message: ChatMessage = { role: 'assistant', content: 'Just doing something.', tool_calls: [{ id: '1', function: { name: 'tool', arguments: '{}' } }] };
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      expect(validateToolCall(message)).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('Tool call blocked'));
      consoleWarnSpy.mockRestore();
    });
  });
});
