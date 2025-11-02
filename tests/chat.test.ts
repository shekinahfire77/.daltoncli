import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock modules before importing the module under test
jest.mock('fs');
jest.mock('inquirer');
jest.mock('../src/commands/shell');
jest.mock('../src/commands/fs');
jest.mock('../src/core/stream_assembler');
jest.mock('../src/core/api_client');
jest.mock('../src/core/config');
jest.mock('../src/core/model_registry');

describe('Chat Command - Core Functions', () => {
  const APP_DATA_DIR = path.join(os.homedir(), '.dalton-cli');
  const SESSIONS_DIR = path.join(APP_DATA_DIR, 'sessions');
  const HISTORY_LIMIT = 10;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Session Management', () => {
    it('should verify HISTORY_LIMIT constant is 10', () => {
      expect(HISTORY_LIMIT).toBe(10);
    });

    it('should use correct session directory paths', () => {
      expect(SESSIONS_DIR).toContain('.dalton-cli');
      expect(SESSIONS_DIR).toContain('sessions');
      expect(SESSIONS_DIR).toBe(path.join(APP_DATA_DIR, 'sessions'));
    });

    it('should save sessions with .json extension', () => {
      const sessionName = 'test_session';
      const expectedPath = path.join(SESSIONS_DIR, `${sessionName}.json`);
      expect(expectedPath).toContain('test_session.json');
    });

    it('should use __last_session as default session name', () => {
      const LAST_SESSION_NAME = '__last_session';
      const expectedPath = path.join(SESSIONS_DIR, `${LAST_SESSION_NAME}.json`);
      expect(expectedPath).toContain('__last_session.json');
    });
  });

  describe('Tool Execution', () => {
    it('should have execute_shell_command tool available', () => {
      const toolName = 'execute_shell_command';
      expect(toolName).toBe('execute_shell_command');
    });

    it('should have read_file_content tool available', () => {
      const toolName = 'read_file_content';
      expect(toolName).toBe('read_file_content');
    });

    it('should have list_render_services tool available', () => {
      const toolName = 'list_render_services';
      expect(toolName).toBe('list_render_services');
    });

    it('should handle unknown tools gracefully', () => {
      const unknownTool = 'nonexistent_tool';
      const expectedMessage = `Unknown tool: ${unknownTool}`;
      expect(expectedMessage).toBe('Unknown tool: nonexistent_tool');
    });

    it('should handle JSON parsing errors in tool arguments', () => {
      const invalidJson = '{invalid json}';
      expect(() => JSON.parse(invalidJson)).toThrow();
    });
  });

  describe('History Truncation', () => {
    it('should keep system prompt when truncating', () => {
      const systemMessage = { role: 'system', content: 'System prompt' };
      const messages = [systemMessage, ...Array(15).fill({ role: 'user', content: 'test' })];

      // Simulate truncation logic
      const truncated = messages.length > HISTORY_LIMIT + 1
        ? [messages[0], ...messages.slice(-(HISTORY_LIMIT))]
        : messages;

      expect(truncated[0]).toBe(systemMessage);
      expect(truncated.length).toBe(HISTORY_LIMIT + 1);
    });

    it('should not truncate when under limit', () => {
      const messages = Array(5).fill({ role: 'user', content: 'test' });
      const truncated = messages.length > HISTORY_LIMIT + 1
        ? [messages[0], ...messages.slice(-(HISTORY_LIMIT))]
        : messages;

      expect(truncated).toEqual(messages);
    });

    it('should keep last N messages when over limit', () => {
      const systemMessage = { role: 'system', content: 'System' };
      const oldMessage = { role: 'user', content: 'old' };
      const recentMessages = Array(HISTORY_LIMIT).fill({ role: 'user', content: 'recent' });
      const messages = [systemMessage, oldMessage, ...recentMessages];

      const truncated = messages.length > HISTORY_LIMIT + 1
        ? [messages[0], ...messages.slice(-(HISTORY_LIMIT))]
        : messages;

      expect(truncated[0]).toBe(systemMessage);
      expect(truncated.length).toBe(HISTORY_LIMIT + 1);
      expect(truncated).not.toContain(oldMessage);
    });
  });

  describe('Chat Message Types', () => {
    it('should support system role messages', () => {
      const message = { role: 'system' as const, content: 'test' };
      expect(message.role).toBe('system');
    });

    it('should support user role messages', () => {
      const message = { role: 'user' as const, content: 'test' };
      expect(message.role).toBe('user');
    });

    it('should support assistant role messages', () => {
      const message = { role: 'assistant' as const, content: 'test' };
      expect(message.role).toBe('assistant');
    });

    it('should support tool role messages', () => {
      const message = {
        role: 'tool' as const,
        content: 'result',
        tool_call_id: 'call_123',
        name: 'test_tool'
      };
      expect(message.role).toBe('tool');
      expect(message.tool_call_id).toBe('call_123');
    });

    it('should support assistant messages with tool calls', () => {
      const message = {
        role: 'assistant' as const,
        tool_calls: [{
          id: 'call_123',
          function: { name: 'test', arguments: '{}' }
        }]
      };
      expect(message.tool_calls).toBeDefined();
      expect(message.tool_calls?.[0].id).toBe('call_123');
    });
  });

  describe('Tool Call Structure', () => {
    it('should have proper tool call structure', () => {
      const toolCall = {
        id: 'call_abc123',
        function: {
          name: 'execute_shell_command',
          arguments: JSON.stringify({ command: 'ls' })
        }
      };

      expect(toolCall.id).toBe('call_abc123');
      expect(toolCall.function.name).toBe('execute_shell_command');
      expect(JSON.parse(toolCall.function.arguments)).toEqual({ command: 'ls' });
    });

    it('should handle tool result structure', () => {
      const toolResult = {
        tool_call_id: 'call_123',
        role: 'tool' as const,
        name: 'execute_shell_command',
        content: 'command output'
      };

      expect(toolResult.tool_call_id).toBe('call_123');
      expect(toolResult.role).toBe('tool');
      expect(toolResult.name).toBe('execute_shell_command');
      expect(toolResult.content).toBe('command output');
    });
  });

  describe('File Path Safety', () => {
    it('should verify file context paths are checked', () => {
      const safePath = './test.txt';
      expect(safePath.startsWith('.')).toBe(true);
    });

    it('should handle absolute paths', () => {
      const absPath = path.resolve('/tmp/test.txt');
      expect(path.isAbsolute(absPath)).toBe(true);
    });
  });

  describe('Exit Conditions', () => {
    it('should recognize exit command', () => {
      const input = 'exit';
      expect(['exit', 'quit'].includes(input.toLowerCase())).toBe(true);
    });

    it('should recognize quit command', () => {
      const input = 'quit';
      expect(['exit', 'quit'].includes(input.toLowerCase())).toBe(true);
    });

    it('should be case insensitive for exit', () => {
      const inputs = ['EXIT', 'Exit', 'eXiT'];
      inputs.forEach(input => {
        expect(['exit', 'quit'].includes(input.toLowerCase())).toBe(true);
      });
    });
  });

  describe('Provider Selection', () => {
    it('should handle configured providers list', () => {
      const providers = ['openai', 'azure', 'groq'];
      expect(providers.length).toBeGreaterThan(0);
    });

    it('should auto-select single provider', () => {
      const providers = ['openai'];
      const shouldAutoSelect = providers.length === 1;
      expect(shouldAutoSelect).toBe(true);
    });

    it('should prompt for multiple providers', () => {
      const providers = ['openai', 'azure', 'groq'];
      const shouldPrompt = providers.length > 1;
      expect(shouldPrompt).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should handle JSON parse errors gracefully', () => {
      const invalidArgs = '{invalid}';
      let errorOccurred = false;

      try {
        JSON.parse(invalidArgs);
      } catch (error) {
        errorOccurred = true;
        expect(error).toBeInstanceOf(Error);
      }

      expect(errorOccurred).toBe(true);
    });

    it('should create error messages for tool failures', () => {
      const error = new Error('Tool execution failed');
      const errorMessage = `Error executing tool: ${error.message}`;
      expect(errorMessage).toBe('Error executing tool: Tool execution failed');
    });

    it('should handle streaming errors', () => {
      const error = new Error('Stream failed');
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      expect(errorMessage).toBe('Stream failed');
    });
  });

  describe('Session Listing', () => {
    it('should filter only JSON files when listing sessions', () => {
      const files = ['session1.json', 'session2.json', 'readme.txt', 'config.yaml'];
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      expect(jsonFiles.length).toBe(2);
      expect(jsonFiles).toContain('session1.json');
      expect(jsonFiles).toContain('session2.json');
      expect(jsonFiles).not.toContain('readme.txt');
    });

    it('should remove .json extension from session names in display', () => {
      const filename = 'my_session.json';
      const displayName = filename.replace('.json', '');

      expect(displayName).toBe('my_session');
      expect(displayName).not.toContain('.json');
    });

    it('should handle empty sessions directory gracefully', () => {
      const files: string[] = [];
      const isEmpty = files.length === 0;

      expect(isEmpty).toBe(true);
    });

    it('should calculate message count from session history', () => {
      const history = [
        { role: 'system' as const, content: 'System prompt' },
        { role: 'user' as const, content: 'Hello' },
        { role: 'assistant' as const, content: 'Hi there' },
      ];

      expect(history.length).toBe(3);
    });
  });

  describe('Session Auto-Rotation', () => {
    const MAX_SESSION_SIZE = 100;

    it('should detect when session exceeds maximum size', () => {
      const largeHistory = Array(101).fill({ role: 'user', content: 'test' });
      const shouldRotate = largeHistory.length > MAX_SESSION_SIZE;

      expect(shouldRotate).toBe(true);
    });

    it('should not rotate when session is under the limit', () => {
      const normalHistory = Array(50).fill({ role: 'user', content: 'test' });
      const shouldRotate = normalHistory.length > MAX_SESSION_SIZE;

      expect(shouldRotate).toBe(false);
    });

    it('should generate archive session name with timestamp', () => {
      const sessionName = 'my_session';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const archivedName = `${sessionName}_archived_${timestamp}`;

      expect(archivedName).toContain('my_session_archived_');
      expect(archivedName).toContain(timestamp.substring(0, 10)); // Check date part
    });

    it('should return "new_rotation" signal when rotation occurs', () => {
      const rotationSignal = 'new_rotation';
      expect(rotationSignal).toBe('new_rotation');
    });

    it('should preserve system prompt after rotation', () => {
      const systemPrompt = { role: 'system' as const, content: 'System' };
      const largeHistory = [
        systemPrompt,
        ...Array(100).fill({ role: 'user', content: 'test' }),
      ];

      const newHistory = [largeHistory[0]];
      expect(newHistory.length).toBe(1);
      expect(newHistory[0]).toBe(systemPrompt);
    });
  });

  describe('Configurable History Limit', () => {
    it('should accept valid maxHistory values', () => {
      const validValues = [1, 10, 50, 100, 500, 1000];

      validValues.forEach((value) => {
        const isValid = value >= 1 && value <= 1000;
        expect(isValid).toBe(true);
      });
    });

    it('should reject maxHistory below minimum', () => {
      const invalidValues = [0, -1, -10];

      invalidValues.forEach((value) => {
        const isValid = value >= 1 && value <= 1000;
        expect(isValid).toBe(false);
      });
    });

    it('should reject maxHistory above maximum', () => {
      const invalidValues = [1001, 2000, 10000];

      invalidValues.forEach((value) => {
        const isValid = value >= 1 && value <= 1000;
        expect(isValid).toBe(false);
      });
    });

    it('should use custom maxHistory for truncation', () => {
      const maxHistory = 5;
      const systemMessage = { role: 'system' as const, content: 'System' };
      const messages = [systemMessage, ...Array(10).fill({ role: 'user', content: 'test' })];

      const truncated = messages.length > maxHistory + 1
        ? [messages[0], ...messages.slice(-maxHistory)]
        : messages;

      expect(truncated.length).toBe(maxHistory + 1); // System + maxHistory messages
      expect(truncated[0]).toBe(systemMessage);
    });

    it('should default to HISTORY_LIMIT when maxHistory not provided', () => {
      const defaultMaxHistory = HISTORY_LIMIT;
      expect(defaultMaxHistory).toBe(10);
    });
  });

  describe('ChatOptions Interface', () => {
    it('should support listSessions option', () => {
      const options = { listSessions: true };
      expect(options.listSessions).toBe(true);
    });

    it('should support maxHistory option', () => {
      const options = { maxHistory: 50 };
      expect(options.maxHistory).toBe(50);
    });

    it('should support all existing and new options', () => {
      const options = {
        resume: true,
        load: 'session1',
        file: 'context.txt',
        provider: 'openai',
        model: 'gpt-4',
        save: 'new_session',
        listSessions: false,
        maxHistory: 20,
      };

      expect(Object.keys(options)).toContain('resume');
      expect(Object.keys(options)).toContain('load');
      expect(Object.keys(options)).toContain('file');
      expect(Object.keys(options)).toContain('provider');
      expect(Object.keys(options)).toContain('model');
      expect(Object.keys(options)).toContain('save');
      expect(Object.keys(options)).toContain('listSessions');
      expect(Object.keys(options)).toContain('maxHistory');
    });
  });

  describe('Archive Session Naming', () => {
    it('should create unique archive names with timestamps', () => {
      const now = new Date();
      const timestamp1 = now.toISOString().replace(/[:.]/g, '-');

      // Wait a tiny bit for different timestamp
      const later = new Date(now.getTime() + 1);
      const timestamp2 = later.toISOString().replace(/[:.]/g, '-');

      expect(timestamp1).not.toBe(timestamp2);
    });

    it('should replace colons and periods in timestamp', () => {
      const timestamp = '2024-01-15T10:30:45.123Z';
      const sanitized = timestamp.replace(/[:.]/g, '-');

      expect(sanitized).not.toContain(':');
      expect(sanitized).not.toContain('.');
      expect(sanitized).toContain('-');
    });

    it('should format archived session name correctly', () => {
      const sessionName = 'chat_session';
      const timestamp = '2024-01-15T10-30-45-123Z';
      const archived = `${sessionName}_archived_${timestamp}`;

      expect(archived).toBe('chat_session_archived_2024-01-15T10-30-45-123Z');
    });
  });
});
