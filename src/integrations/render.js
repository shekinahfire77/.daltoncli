const axios = require('axios');
const { readConfig } = require('../core/config');
const chalk = require('chalk');

const getRenderApiKey = () => {
  const config = readConfig();
  const renderConfig = config.mcp_integrations?.render;
  if (!renderConfig || !renderConfig.api_key) {
    return null;
  }
  return renderConfig.api_key;
};

const listServices = async () => {
  const apiKey = getRenderApiKey();
  if (!apiKey) {
    return 'Error: Render API key not configured. Please use \'dalton-cli configure mcp set render api_key <key>\'
';
  }

  try {
    console.log(chalk.blue('Fetching services from Render...'));
    const response = await axios.get('https://api.render.com/v1/services', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
    });

    const services = response.data.map(item => ({
      id: item.service.id,
      name: item.service.name,
      type: item.service.type,
      url: item.service.serviceDetails.url || 'N/A',
    }));

    if (services.length === 0) {
      return 'No services found on your Render account.';
    }

    // Return a formatted string for the AI to present
    return `Found ${services.length} services:\n` + services.map(s => `- ${s.name} (${s.type}) at ${s.url}`).join('\n');

  } catch (error) {
    console.error(chalk.red('Error fetching Render services:'), error.response?.data || error.message);
    return `Error fetching Render services: ${error.response?.data?.message || error.message}`;
  }
};

module.exports = { listServices };
