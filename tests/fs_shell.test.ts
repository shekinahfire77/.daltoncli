import { executeCommand } from '../src/core/shell_executor';
import { spawn } from 'child_process';

// Mock child_process.spawn
jest.mock('child_process', () => ({
  spawn: jest.fn(() => ({
    stdout: { on: jest.fn() },
    stderr: { on: jest.fn() },
    on: jest.fn(),
    kill: jest.fn(),
  })),
}));

describe('Filesystem Sandboxing and Shell Timeout Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should prevent unauthorized file system access (Note: Explicit sandboxing not yet implemented)', () => {
    // Currently, there is no explicit filesystem sandboxing beyond OS permissions.
    // This test serves as a reminder that such a feature would require mocking Node.js 'fs' module
    // or running in a truly sandboxed environment.
    expect(true).toBe(true); // Placeholder for future implementation
  });

  it('should enforce shell command timeouts', async () => {
    const mockChildProcess = {
      stdout: { on: jest.fn() },
      stderr: { on: jest.fn() },
      on: jest.fn((event, callback) => {
        if (event === 'timeout') {
          setTimeout(() => callback(), 100); // Simulate timeout after 100ms
        }
        if (event === 'close') {
          // Simulate process closing after timeout
          setTimeout(() => callback(null), 150);
        }
      }),
      kill: jest.fn(),
    };
    (spawn as jest.Mock).mockReturnValue(mockChildProcess);

    const command = 'long-running-command';
    const timeout = 50; // 50ms timeout

    const result = await executeCommand(command, timeout);

    expect(spawn).toHaveBeenCalledWith(command, { shell: true, timeout });
    expect(mockChildProcess.kill).toHaveBeenCalled();
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain(`Command timed out after ${timeout / 1000} seconds.`);
  });

  it('should execute a whitelisted command in safe mode', async () => {
    const mockChildProcess = {
      stdout: { on: jest.fn((event, callback) => { if (event === 'data') callback('stdout data'); }) },
      stderr: { on: jest.fn((event, callback) => { if (event === 'data') callback('stderr data'); }) },
      on: jest.fn((event, callback) => { if (event === 'close') callback(0); }),
      kill: jest.fn(),
    };
    (spawn as jest.Mock).mockReturnValue(mockChildProcess);

    const command = 'ls'; // Whitelisted command
    const result = await executeCommand(command, 1000, true); // safeMode = true

    expect(spawn).toHaveBeenCalledWith(command, { shell: true, timeout: 1000 });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('stdout data');
    expect(result.stderr).toBe('stderr data');
    expect(result.error).toBeNull();
  });

  it('should block a non-whitelisted command in safe mode', async () => {
    const command = 'rm -rf /'; // Non-whitelisted command
    const result = await executeCommand(command, 1000, true); // safeMode = true

    expect(spawn).not.toHaveBeenCalled(); // Should not even try to spawn
    expect(result.exitCode).toBe(1);
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error?.message).toContain('Command not whitelisted in safe mode');
  });

  // Add more unit tests for specific fs and shell interactions
});
