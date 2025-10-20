import { startSession, logSession, endSession } from '../src/core/session_logger';
import * as fsPromises from 'fs/promises';
import * as path from 'path';
import { redactSecrets } from '../src/core/secret_manager';

// Mock fs/promises module
jest.mock('fs/promises', () => ({
  mkdir: jest.fn(),
  writeFile: jest.fn(),
  appendFile: jest.fn(),
}));

// Mock redactSecrets
jest.mock('../src/core/secret_manager', () => ({
  redactSecrets: jest.fn(async (msg) => msg), // Default: return message unredacted
}));

describe('Session Logger', () => {
  const MOCK_SESSION_DIR = path.join(process.cwd(), '.daltoncli_sessions');
  const MOCK_TIMESTAMP_REGEX = /session-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.log/;
  const MOCK_NAMED_TIMESTAMP_REGEX = /session-my-session-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.log/;

  beforeEach(() => {
    jest.clearAllMocks();
    (fsPromises.mkdir as jest.Mock).mockResolvedValue(undefined);
    (fsPromises.writeFile as jest.Mock).mockResolvedValue(undefined);
    (fsPromises.appendFile as jest.Mock).mockResolvedValue(undefined);
  });

  describe('startSession', () => {
    it('should create session directory and file with default name', async () => {
      await startSession();
      expect(fsPromises.mkdir).toHaveBeenCalledWith(MOCK_SESSION_DIR, { recursive: true });
      expect(fsPromises.writeFile).toHaveBeenCalledWith(expect.stringMatching(MOCK_TIMESTAMP_REGEX), expect.any(String), { encoding: 'utf8' });
    });

    it('should create session file with provided name', async () => {
      await startSession('my-session');
      expect(fsPromises.mkdir).toHaveBeenCalledWith(MOCK_SESSION_DIR, { recursive: true });
      expect(fsPromises.writeFile).toHaveBeenCalledWith(expect.stringMatching(MOCK_NAMED_TIMESTAMP_REGEX), expect.any(String), { encoding: 'utf8' });
    });

    it('should handle errors during directory creation', async () => {
      (fsPromises.mkdir as jest.Mock).mockRejectedValue(new Error('Permission denied'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await startSession();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle errors during file creation', async () => {
      (fsPromises.writeFile as jest.Mock).mockRejectedValue(new Error('Disk full'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await startSession();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('logSession', () => {
    beforeEach(async () => {
      await startSession(); // Ensure session is started for logging
    });

    it('should append log entry to file', async () => {
      const details = { message: 'test log' };
      await logSession('TEST_EVENT', details);
      expect(fsPromises.appendFile).toHaveBeenCalledWith(expect.any(String), expect.stringContaining('"eventType":"TEST_EVENT","details":{"message":"test log"}'), { encoding: 'utf8' });
    });

    it('should redact secrets in log entry', async () => {
      (redactSecrets as jest.Mock).mockResolvedValue('REDACTED_LOG_ENTRY');
      const details = { secret: 'supersecret' };
      await logSession('SECRET_EVENT', details);
      expect(redactSecrets).toHaveBeenCalledWith(expect.stringContaining('supersecret'));
      expect(fsPromises.appendFile).toHaveBeenCalledWith(expect.any(String), 'REDACTED_LOG_ENTRY\n', { encoding: 'utf8' });
    });

    it('should warn if session not started', async () => {
      // End the current session to reset sessionFilePath to null
      await endSession();

      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await logSession('NO_SESSION', {});
      expect(consoleWarnSpy).toHaveBeenCalledWith("Session not started. Log entry will not be recorded.");
      consoleWarnSpy.mockRestore();
    });

    it('should handle errors during appending to file', async () => {
      (fsPromises.appendFile as jest.Mock).mockRejectedValue(new Error('Write error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await logSession('WRITE_ERROR', {});
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('endSession', () => {
    beforeEach(async () => {
      await startSession(); // Ensure session is started
    });

    it('should append end message and clear session file path', async () => {
      await endSession();
      expect(fsPromises.appendFile).toHaveBeenCalledWith(expect.any(String), '# End of Session\n', { encoding: 'utf8' });
      // sessionFilePath is not exported, so we can't directly test it
      // But we can verify that logging after endSession triggers a warning
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await logSession('AFTER_END', {});
      expect(consoleWarnSpy).toHaveBeenCalledWith("Session not started. Log entry will not be recorded.");
      consoleWarnSpy.mockRestore();
    });

    it('should handle errors during appending end message', async () => {
      (fsPromises.appendFile as jest.Mock).mockRejectedValue(new Error('End write error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      await endSession();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
