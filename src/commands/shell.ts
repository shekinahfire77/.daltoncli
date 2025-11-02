import { exec } from 'child_process';
import inquirer from 'inquirer';
import chalk from 'chalk';
import * as os from 'os';
import { getShellLimits } from '../core/app_limits';

/**
 * Determines the appropriate shell to use based on the operating system
 * @returns The shell executable path
 */
const getShellExecutable = (): string => {
  const platform = os.platform();

  if (platform === 'win32') {
    // On Windows, use PowerShell
    return 'powershell.exe';
  }

  // On Unix-like systems (Linux, macOS), use bash or fallback to sh
  return process.env.SHELL || '/bin/bash';
};

/**
 * Custom error class for shell execution errors
 */
class ShellExecutionError extends Error {
  constructor(
    message: string,
    public exitCode?: number,
    public stderr?: string,
  ) {
    super(message);
    this.name = 'ShellExecutionError';
  }
}

/**
 * Validates shell command input
 * @param command - The command to validate
 * @returns true if valid, false otherwise
 */
const validateCommand = (command: string): { valid: boolean; error?: string } => {
  const shellLimits = getShellLimits();

  // DEFENSIVE: Validate command type and length
  if (typeof command !== 'string') {
    return { valid: false, error: 'Command must be a string' };
  }

  if (command.trim().length === 0) {
    return { valid: false, error: 'Command cannot be empty' };
  }

  if (command.length > shellLimits.maxCommandLength) {
    return {
      valid: false,
      error: `Command exceeds maximum length of ${shellLimits.maxCommandLength} characters`,
    };
  }

  // DEFENSIVE: Basic command injection check
  if (command.includes('\0') || command.includes('\n') || command.includes('\r')) {
    return { valid: false, error: 'Command contains invalid control characters' };
  }

  return { valid: true };
};

/**
 * Confirms command execution with user and runs the command
 * @param command - The shell command to execute
 * @param isToolCall - Whether this is called from a tool invocation (requires user confirmation)
 * @param nonInteractive - Whether to auto-approve execution without prompting
 * @returns Promise resolving to the command output or error message
 * @throws {ShellExecutionError} If command execution fails
 */
const confirmAndExecute = async (command: string, isToolCall: boolean = false, nonInteractive: boolean = false): Promise<string> => {
  // DEFENSIVE: Validate input before processing
  const validation = validateCommand(command);
  if (!validation.valid) {
    const errorMsg = `Command validation failed: ${validation.error}`;
    console.error(chalk.red(errorMsg));
    throw new ShellExecutionError(errorMsg);
  }

  let execute: boolean = true;
  if (isToolCall && !nonInteractive) {
    try {
      const { confirmation } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirmation',
          message: `Shekinah wants to run the command: ${chalk.yellow(command)}\nAllow execution?`,
          default: true,
        },
      ]);
      execute = confirmation;
    } catch (error) {
      // DEFENSIVE: Handle inquirer errors gracefully
      const errorMsg = error instanceof Error ? error.message : 'Unknown error during confirmation';
      console.error(chalk.red(`Confirmation prompt failed: ${errorMsg}`));
      throw new ShellExecutionError(`Failed to confirm command execution: ${errorMsg}`);
    }
  }

  if (!execute) {
    const message: string = 'Execution cancelled by user.';
    console.log(chalk.red(message));
    return message;
  }

  // DEFENSIVE: Execute command with proper error handling
  return new Promise<string>((resolve, reject) => {
    const shellLimits = getShellLimits();
    const shellExecutable = getShellExecutable();
    const platform = os.platform();

    try {
      // Configure exec options with the appropriate shell
      const execOptions: any = {
        timeout: shellLimits.execTimeout,
        shell: shellExecutable,
      };

      // On Windows, if using PowerShell, we need to wrap the command
      let execCommand = command;
      if (platform === 'win32' && shellExecutable === 'powershell.exe') {
        const encodedCommand = Buffer.from(command, 'utf16le').toString('base64');
        execCommand = `${shellExecutable} -NoProfile -NonInteractive -EncodedCommand ${encodedCommand}`;
        execOptions.shell = true;  // Use default shell to execute PowerShell
      }

      const child = exec(execCommand, execOptions, (error, stdout, stderr) => {
        const stderrStr = stderr.toString();
        const stdoutStr = stdout.toString();
        const combinedOutput: string = `STDOUT:\n${stdoutStr}\n\nSTDERR:\n${stderrStr}`;

        if (error) {
          const shellError = new ShellExecutionError(
            `Command execution failed: ${error.message}`,
            error.code ?? undefined,
            stderrStr,
          );
          console.error(chalk.red(`Execution Error: ${error.message}`));
          resolve(`EXECUTION FAILED with error: ${error.message}\n\n${combinedOutput}`);
        } else {
          console.log(chalk.gray(combinedOutput));
          resolve(combinedOutput);
        }
      });

      // DEFENSIVE: Handle child process errors
      child.on('error', (error) => {
        const errorMsg = `Failed to execute command: ${error.message}`;
        console.error(chalk.red(errorMsg));
        reject(new ShellExecutionError(errorMsg));
      });
    } catch (error) {
      // DEFENSIVE: Catch synchronous errors in exec setup
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error(chalk.red(`Failed to setup command execution: ${errorMsg}`));
      reject(new ShellExecutionError(`Setup error: ${errorMsg}`));
    }
  });
};

/**
 * Executes a shell command with user confirmation if from tool call
 * @param command - The shell command to execute
 * @param isToolCall - Whether this is called from a tool invocation
 * @param nonInteractive - Whether to auto-approve execution without prompting
 * @returns Promise or string with command output
 */
const handleShell = (command: string, isToolCall: boolean = false, nonInteractive: boolean = false): Promise<string> | string => {
  // DEFENSIVE: Validate input parameter at function entry
  if (typeof command !== 'string') {
    const message: string = 'Error: Command must be a string';
    console.error(chalk.red(message));
    return message;
  }

  if (!command || command.trim().length === 0) {
    const message: string = 'Error: No command provided. Example: dalton-cli shell "ls -l"';
    console.error(chalk.red(message));
    return message;
  }

  try {
    return confirmAndExecute(command, isToolCall, nonInteractive).catch((error) => {
      // DEFENSIVE: Handle promise rejection and convert to string result
      if (error instanceof ShellExecutionError) {
        return `Error: ${error.message}`;
      }
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      return `Error: Failed to execute shell command: ${errorMsg}`;
    });
  } catch (error) {
    // DEFENSIVE: Catch any synchronous errors
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    const message = `Error: Unexpected error in shell handler: ${errorMsg}`;
    console.error(chalk.red(message));
    return message;
  }
};

export default handleShell;
export { ShellExecutionError };
