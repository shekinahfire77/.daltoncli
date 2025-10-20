const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const projectRoot = fs.realpathSync(path.resolve(__dirname, '../../'));
const MAX_READ_BYTES = 50000; // 50 KB limit

const isPathSafe = (filePath) => {
  try {
    const resolvedPath = fs.realpathSync(path.resolve(filePath));
    return resolvedPath.startsWith(projectRoot);
  } catch (error) {
    // Path does not exist or is invalid
    return false;
  }
};

const readFile = (filePath) => {
  if (!isPathSafe(filePath)) {
    const errorMessage = `Access Denied: Cannot read files outside of the project directory.`;
    console.error(chalk.red(errorMessage));
    return errorMessage;
  }

  try {
    if (!fs.existsSync(filePath)) {
      const errorMessage = `Error: File not found at '${filePath}'`;
      console.error(chalk.red(errorMessage));
      return errorMessage;
    }
    const stats = fs.statSync(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');

    console.log(`--- Content of ${filePath} ---`);
    if (stats.size > MAX_READ_BYTES) {
      console.log(chalk.yellow(`File is large (${stats.size} bytes). Truncating to ${MAX_READ_BYTES} bytes.`));
      console.log(content.substring(0, MAX_READ_BYTES));
      return content.substring(0, MAX_READ_BYTES) + '\n... (file truncated)';
    } else {
      console.log(content);
      return content;
    }
  } catch (error) {
    console.error(chalk.red(`Error reading file: ${error.message}`));
    return `Error reading file: ${error.message}`;
  }
};

const handleFs = (action, args = [], isToolCall = false) => {
  switch (action) {
    case 'read':
      const [filePath] = args;
      if (!filePath) {
        const errorMessage = 'Error: \'read\' action requires a file path.';
        console.error(chalk.red(errorMessage));
        return errorMessage;
      }
      return readFile(filePath);
    default:
      const errorMessage = `Error: Unknown filesystem action '${action}'. Available actions: 'read'`;
      console.error(chalk.red(errorMessage));
      return errorMessage;
  }
};

module.exports = { handleFs, isPathSafe };
