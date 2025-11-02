// Test file reading commands
const { executeCommand } = require('./dist/src/core/shell_executor');

async function testFileReading() {
  console.log('Testing file reading commands...\n');

  const tests = [
    {
      name: 'Read package.json (bash cat)',
      command: 'cat package.json',
    },
    {
      name: 'Read first 5 lines of package.json',
      command: 'head -n 5 package.json',
    },
    {
      name: 'Read last 3 lines of README.md',
      command: 'tail -n 3 README.md',
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
      const output = result.stdout.trim();
      console.log('Output (first 300 chars):', output.substring(0, 300) + (output.length > 300 ? '...' : ''));
    } else {
      console.log('❌ FAILED');
      console.log('STDERR:', result.stderr.substring(0, 300));
    }
  }

  console.log('\n\n' + '='.repeat(60));
  console.log('All file reading tests completed');
  console.log('='.repeat(60));
}

testFileReading();
