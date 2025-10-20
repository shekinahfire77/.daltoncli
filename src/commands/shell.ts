const { exec } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');

const EXEC_TIMEOUT = 15000; // 15 seconds

const confirmAndExecute = async (command, isToolCall = false) => {
  let execute = true;
  if (isToolCall) {
    const { confirmation } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirmation',
        message: `Shekinah wants to run the command: ${chalk.yellow(command)}
Allow execution?`,
        default: true,
      },
    ]);
    execute = confirmation;
  }

  if (!execute) {
    const message = 'Execution cancelled by user.';
    console.log(chalk.red(message));
    return message;
  }

  return new Promise((resolve) => {
    exec(command, { timeout: EXEC_TIMEOUT }, (error, stdout, stderr) => {
      const combinedOutput = `STDOUT:\n${stdout}\n\nSTDERR:\n${stderr}`;
      if (error) {
        console.error(chalk.red(`Execution Error: ${error.message}`));
        // On error, we still resolve, but pass the error message in the output
        resolve(`EXECUTION FAILED with error: ${error.message}\n\n${combinedOutput}`);
      } else {
        console.log(chalk.gray(combinedOutput));
        resolve(combinedOutput);
      }
    });
  });
};

const handleShell = (command, isToolCall = false) => {
  if (!command) {
    const message = 'Error: No command provided. Example: dalton-cli shell "ls -l"';
    console.error(chalk.red(message));
    return message;
  }
  return confirmAndExecute(command, isToolCall);
};

module.exports = handleShell;
