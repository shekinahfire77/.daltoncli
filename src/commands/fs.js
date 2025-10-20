const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const projectRoot = path.resolve(__dirname, '../../');

const isPathSafe = (filePath) => {
  const resolvedPath = path.resolve(filePath);
  return resolvedPath.startsWith(projectRoot);
};

const readFile = (filePath) => {
  if (!isPathSafe(filePath)) {
    const errorMessage = `Access Denied: Cannot read files outside of the project directory.`;
    console.error(chalk.red(errorMessage));
    return errorMessage; // Return a message for the AI
  }

  try {
    if (!fs.existsSync(filePath)) {
      const errorMessage = `Error: File not found at '${filePath}'`;
      console.error(chalk.red(errorMessage));
      return errorMessage; // Return a message for the AI
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    console.log(`--- Content of ${filePath} ---
`);
    console.log(content);
    return content; // Return content for the AI
  } catch (error) {
    console.error(chalk.red(`Error reading file: ${error.message}`));
    return `Error reading file: ${error.message}`; // Return a message for the AI
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

module.exports = handleFs;