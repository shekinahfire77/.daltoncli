import { spawn } from 'child_process';

interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  error: Error | null;
}

const SAFE_COMMAND_WHITELIST = [
  'ls', 'dir', 'cat', 'more', 'less', 'grep', 'find', 'echo', 'pwd',
  'git --version', 'node --version', 'npm --version', 'python --version',
];

export async function executeCommand(
  command: string,
  timeout: number = 60000, // Default to 60 seconds
  safeMode: boolean = false,
): Promise<CommandResult> {
  if (safeMode) {
    const isWhitelisted = SAFE_COMMAND_WHITELIST.includes(command);
    if (!isWhitelisted) {
      return {
        stdout: '',
        stderr: `Command '${command}' is not whitelisted for safe mode execution.`, 
        exitCode: 1,
        error: new Error('Command not whitelisted in safe mode'),
      };
    }
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let commandError: Error | null = null;

    const child = spawn(command, { shell: true, timeout });

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      commandError = error;
      resolve({
        stdout,
        stderr,
        exitCode: null,
        error: commandError,
      });
    });

    child.on('close', (exitCode) => {
      resolve({
        stdout,
        stderr,
        exitCode,
        error: commandError,
      });
    });

    child.on('timeout', () => {
      commandError = new Error(`Command timed out after ${timeout / 1000} seconds.`);
      child.kill(); // Kill the process if it times out
    });
  });
}
