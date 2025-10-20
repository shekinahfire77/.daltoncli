require('dotenv').config();

const config = {
  openaiApiKey: process.env.OPENAI_API_KEY,
  azureApiKey: process.env.AZURE_API_KEY,
  azureApiEndpoint: process.env.AZURE_API_ENDPOINT,
};

module.exports = config;
