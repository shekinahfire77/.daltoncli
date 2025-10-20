const { exec } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');

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
    console.log(chalk.red('Execution cancelled by user.'));
    return 'Execution cancelled by user.'; // Return a message for the AI
  }

  return new Promise((resolve) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(chalk.red(`Execution Error: ${error.message}`));
        resolve(`Execution Error: ${error.message}`); // Return error message for the AI
      }
      if (stderr) {
        console.log(chalk.yellow(`Stderr: ${stderr}`));
      }
      console.log(chalk.gray(`Stdout: ${stdout}`));
      resolve(stdout || stderr || 'Command executed successfully.'); // Return output for the AI
    });
  });
};

const handleShell = (command, isToolCall = false) => {
  if (!command) {
    console.error(chalk.red('Error: No command provided.'));
    console.log('Example: dalton-cli shell "ls -l"');
    return;
  }
  return confirmAndExecute(command, isToolCall);
};

module.exports = handleShell;