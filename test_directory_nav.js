// Test directory listing and navigation commands
const { executeCommand } = require('./dist/src/core/shell_executor');

async function testDirectoryCommands() {
  console.log('Testing directory navigation and listing commands...\n');

  const tests = [
    {
      name: 'List files in current directory',
      command: 'ls',
    },
    {
      name: 'List all files including hidden (bash syntax)',
      command: 'ls -la',
    },
    {
      name: 'Check if src directory exists',
      command: 'if [ -d src ]; then echo "src directory exists"; else echo "src directory not found"; fi',
    },
    {
      name: 'Print current directory',
      command: 'pwd',
    },
  ];

  for (const test of tests) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test: ${test.name}`);
    console.log(`Command: ${test.command}`);
    console.log('='.repeat(60));

    const result = await executeCommand(test.command, 10000, false);

    if (result.exitCode === 0) {
      console.log('✅ PASSED');
      console.log('Output:', result.stdout.substring(0, 200));
    } else {
      console.log('❌ FAILED');
      console.log('STDERR:', result.stderr.substring(0, 200));
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('All directory navigation tests completed');
  console.log('='.repeat(60));
}

testDirectoryCommands();
