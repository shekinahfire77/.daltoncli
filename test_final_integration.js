// Final integration test - verifies all PowerShell compatibility fixes
const { executeCommand } = require('./dist/src/core/shell_executor');

const TESTS = [
  {
    category: 'Basic Commands',
    tests: [
      {
        name: 'Current directory (pwd)',
        command: 'pwd',
        expectedExitCode: 0,
      },
      {
        name: 'List files (ls)',
        command: 'ls',
        expectedExitCode: 0,
      },
      {
        name: 'List all files (ls -la)',
        command: 'ls -la',
        expectedExitCode: 0,
      },
    ],
  },
  {
    category: 'File Existence Checks',
    tests: [
      {
        name: 'Check if package.json exists (simple test -f)',
        command: 'test -f package.json',
        expectedExitCode: 0,
      },
      {
        name: 'Check if package.json exists (complex conditional)',
        command: 'if [ -f package.json ]; then echo "exists"; else echo "not found"; fi',
        expectedExitCode: 0,
        expectedOutput: 'exists',
      },
      {
        name: 'Check if nonexistent file exists',
        command: 'if [ -f nonexistent.xyz ]; then echo "exists"; else echo "not found"; fi',
        expectedExitCode: 0,
        expectedOutput: 'not found',
      },
    ],
  },
  {
    category: 'Directory Checks',
    tests: [
      {
        name: 'Check if src directory exists (simple test -d)',
        command: 'test -d src',
        expectedExitCode: 0,
      },
      {
        name: 'Check if src directory exists (complex conditional)',
        command: 'if [ -d src ]; then echo "exists"; else echo "not found"; fi',
        expectedExitCode: 0,
        expectedOutput: 'exists',
      },
    ],
  },
  {
    category: 'File Reading',
    tests: [
      {
        name: 'Read file (cat)',
        command: 'cat package.json',
        expectedExitCode: 0,
      },
      {
        name: 'Read first 5 lines (head -n)',
        command: 'head -n 5 package.json',
        expectedExitCode: 0,
      },
      {
        name: 'Read last 3 lines (tail -n)',
        command: 'tail -n 3 README.md',
        expectedExitCode: 0,
      },
    ],
  },
];

async function runTests() {
  console.log('=' .repeat(70));
  console.log('  DALTON CLI - PowerShell Compatibility Integration Test');
  console.log('=' .repeat(70));
  console.log('');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  for (const category of TESTS) {
    console.log(`\\n${'▼'.repeat(3)} ${category.category} ${'▼'.repeat(3)}\\n`);

    for (const test of category.tests) {
      totalTests++;
      const testNum = totalTests.toString().padStart(2, '0');

      process.stdout.write(`  [${testNum}] ${test.name}... `);

      try {
        const result = await executeCommand(test.command, 10000, false);

        // Check exit code
        if (result.exitCode !== test.expectedExitCode) {
          console.log('❌ FAILED (wrong exit code)');
          console.log(`      Expected: ${test.expectedExitCode}, Got: ${result.exitCode}`);
          console.log(`      STDERR: ${result.stderr.substring(0, 100)}`);
          failedTests++;
          continue;
        }

        // Check expected output if specified
        if (test.expectedOutput && !result.stdout.toLowerCase().includes(test.expectedOutput.toLowerCase())) {
          console.log('❌ FAILED (wrong output)');
          console.log(`      Expected output to contain: "${test.expectedOutput}"`);
          console.log(`      Got: "${result.stdout.substring(0, 100)}"`);
          failedTests++;
          continue;
        }

        console.log('✅ PASSED');
        passedTests++;
      } catch (error) {
        console.log('❌ FAILED (exception)');
        console.log(`      Error: ${error.message}`);
        failedTests++;
      }
    }
  }

  console.log('\\n' + '='.repeat(70));
  console.log('  TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`  Total:  ${totalTests}`);
  console.log(`  ✅ Passed: ${passedTests} (${Math.round(passedTests / totalTests * 100)}%)`);
  console.log(`  ❌ Failed: ${failedTests} (${Math.round(failedTests / totalTests * 100)}%)`);
  console.log('='.repeat(70));

  if (failedTests === 0) {
    console.log('\\n  🎉 ALL TESTS PASSED! PowerShell compatibility is working flawlessly!\\n');
    process.exit(0);
  } else {
    console.log('\\n  ⚠️  Some tests failed. Review the output above for details.\\n');
    process.exit(1);
  }
}

runTests();
