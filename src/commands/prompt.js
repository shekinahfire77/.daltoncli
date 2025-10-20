const { sendPromptToAI } = require('../core/api_client');

const handlePrompt = async (message, options) => {
  try {
    const response = await sendPromptToAI(message, { model: options.model });
    console.log('\nAI Response:');
    console.log(response);
  } catch (error) {
    // The api_client already logs the technical error.
    // We can add a more user-friendly message here if needed.
    console.error('\nFailed to get a response from the AI.');
    process.exit(1);
  }
};

module.exports = handlePrompt;
