import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';
import { getFileLimits } from '../core/app_limits';

/**
 * Project root directory for validating file access
 */
const projectRoot: string = fs.realpathSync(path.resolve(__dirname, '../../'));

/**
 * Validates that a file path is safe and within the project directory
 * Prevents directory traversal and symlink attacks
 * @param filePath - The file path to validate
 * @returns true if the path is safe, false otherwise
 */
export const isPathSafe = (filePath: string): boolean => {
  try {
    if (typeof filePath !== 'string' || filePath.trim().length === 0) {
      return false;
    }

    if (filePath.includes('\0')) {
      return false;
    }

    const traversalCount = (filePath.match(/\.\.\//g) || []).length;
    if (traversalCount > 5) {
      return false;
    }

    const resolvedPath: string = fs.realpathSync(path.resolve(filePath));
    const normalizedRoot = path.normalize(projectRoot);
    const normalizedResolved = path.normalize(resolvedPath);
    const relativePath = path.relative(normalizedRoot, normalizedResolved);

    if (relativePath.startsWith('..')) {
      return false;
    }

    return normalizedResolved.startsWith(normalizedRoot);
  } catch (error) {
    return false;
  }
};

/**
 * Reads a file from the project directory
 * @param filePath - Path to the file to read
 * @returns The file content or error message
 */
const readFile = (filePath: string): string => {
  if (!isPathSafe(filePath)) {
    const errorMessage: string = `Access Denied: Cannot read files outside of the project directory.`;
    console.error(chalk.red(errorMessage));
    return errorMessage;
  }

  try {
    if (!fs.existsSync(filePath)) {
      const errorMessage: string = `Error: File not found at '${filePath}'`;
      console.error(chalk.red(errorMessage));
      return errorMessage;
    }

    const fileLimits = getFileLimits();
    const stats: fs.Stats = fs.statSync(filePath);
    const content: string = fs.readFileSync(filePath, 'utf-8');

    console.log(`--- Content of ${filePath} ---`);
    if (stats.size > fileLimits.maxReadBytes) {
      console.log(chalk.yellow(`File is large (${stats.size} bytes). Truncating to ${fileLimits.maxReadBytes} bytes.`));
      console.log(content.substring(0, fileLimits.maxReadBytes));
      return content.substring(0, fileLimits.maxReadBytes) + '\n... (file truncated)';
    } else {
      console.log(content);
      return content;
    }
  } catch (error) {
    const errorMessage: string = error instanceof Error ? error.message : 'Unknown error';
    console.error(chalk.red(`Error reading file: ${errorMessage}`));
    return `Error reading file: ${errorMessage}`;
  }
};

/**
 * Handles filesystem operations
 * @param action - The filesystem action to perform ('read')
 * @param args - Arguments for the action (e.g., file path)
 * @param isToolCall - Whether this is called from a tool invocation
 * @returns The operation result or error message
 */
export const handleFs = (action: string, args: string[] = [], isToolCall: boolean = false): string | Promise<string> => {
  switch (action) {
    case 'read':
      const [filePath] = args;
      if (!filePath) {
        const errorMessage: string = 'Error: \'read\' action requires a file path.';
        console.error(chalk.red(errorMessage));
        return errorMessage;
      }
      return readFile(filePath);
    default:
      const errorMessage: string = `Error: Unknown filesystem action '${action}'. Available actions: 'read'`;
      console.error(chalk.red(errorMessage));
      return errorMessage;
  }
};
