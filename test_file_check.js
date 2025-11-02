// Quick test script to verify the bash-to-PowerShell translator
// This simulates what Shekinah would generate

const { executeCommand } = require('./dist/src/core/shell_executor');

async function test() {
  console.log('Testing bash conditional translation...\n');

  // Test case: bash if-then-else-fi syntax
  const bashCommand = 'if [ -f package.json ]; then echo "package.json exists"; else echo "package.json does not exist"; fi';

  console.log('Original bash command:');
  console.log(bashCommand);
  console.log('\n---\n');

  const result = await executeCommand(bashCommand, 10000, false);

  console.log('Result:');
  console.log('STDOUT:', result.stdout);
  console.log('STDERR:', result.stderr);
  console.log('Exit Code:', result.exitCode);

  if (result.exitCode === 0) {
    console.log('\n✅ TEST PASSED - Command executed successfully');
  } else {
    console.log('\n❌ TEST FAILED - Command execution failed');
  }
}

test();
