// Automated conversation flow test
// This simulates a user conversation with multiple tool calls

const { spawn } = require('child_process');
const path = require('path');

async function testConversation() {
  console.log('Starting automated Shekinah conversation test...\n');

  const cliPath = path.join(__dirname, 'dist', 'src', 'index.js');

  return new Promise((resolve, reject) => {
    // Spawn the CLI process
    const child = spawn('node', [
      cliPath,
      'shekinah',
      'chat',
      '--non-interactive',
      '--model',
      'gpt-5-nano',
    ], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    let errors = '';

    child.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      // Print in real-time
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      errors += text;
      process.stderr.write(text);
    });

    // Send the test message
    setTimeout(() => {
      const testMessage = "Show me the current directory and check if package.json exists.\\n";
      console.log(`\\n[TEST] Sending message: ${testMessage.trim()}`);
      child.stdin.write(testMessage);

      // Wait for response, then send exit
      setTimeout(() => {
        console.log('\\n[TEST] Sending exit command...');
        child.stdin.write('exit\\n');
        child.stdin.end();
      }, 15000); // Wait 15 seconds for Shekinah to respond
    }, 3000); // Wait 3 seconds for initialization

    child.on('close', (code) => {
      console.log(`\\n\\n[TEST] Process exited with code ${code}`);

      if (code === 0 || code === null) {
        console.log('✅ Conversation test completed');
        resolve({ output, errors, exitCode: code });
      } else {
        console.log('❌ Conversation test failed');
        reject(new Error(`Process exited with code ${code}`));
      }
    });

    child.on('error', (err) => {
      console.error('❌ Failed to start process:', err);
      reject(err);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      child.kill();
      reject(new Error('Test timeout after 30 seconds'));
    }, 30000);
  });
}

testConversation()
  .then(() => {
    console.log('\\n[TEST] All conversation tests completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\\n[TEST] Conversation test failed:', err.message);
    process.exit(1);
  });
