const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../../.env');

const readEnvFile = () => {
  if (!fs.existsSync(envPath)) {
    return {};
  }
  const fileContent = fs.readFileSync(envPath, { encoding: 'utf-8' });
  const envConfig = {};
  fileContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      envConfig[key.trim()] = value.trim();
    }
  });
  return envConfig;
};

const writeEnvFile = (config) => {
  const fileContent = Object.entries(config)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  fs.writeFileSync(envPath, fileContent, { encoding: 'utf-8' });
};

const setApiKey = (provider, key, endpoint) => {
  const envConfig = readEnvFile();
  const keyName = `${provider.toUpperCase()}_API_KEY`;
  envConfig[keyName] = key;

  if (provider.toLowerCase() === 'azure' && endpoint) {
    const endpointName = `${provider.toUpperCase()}_API_ENDPOINT`;
    envConfig[endpointName] = endpoint;
    console.log(`API key and endpoint for ${provider} have been set.`);
  } else {
    console.log(`API key for ${provider} has been set.`);
  }

  writeEnvFile(envConfig);
};

const listApiKeys = () => {
  const envConfig = readEnvFile();
  console.log('Configured API Providers:');
  const providers = new Set();
  Object.keys(envConfig).forEach(key => {
    if (key.endsWith('_API_KEY')) {
      providers.add(key.replace('_API_KEY', '').toLowerCase());
    }
    if (key.endsWith('_API_ENDPOINT')) {
      providers.add(key.replace('_API_ENDPOINT', '').toLowerCase());
    }
  });

  providers.forEach(provider => {
    const keyName = `${provider.toUpperCase()}_API_KEY`;
    const endpointName = `${provider.toUpperCase()}_API_ENDPOINT`;
    if (envConfig[endpointName]) {
      console.log(`- ${provider} (key and endpoint set)`);
    } else if (envConfig[keyName]) {
      console.log(`- ${provider} (key set)`);
    }
  });
};

const handleConfigure = (action, provider, key, endpoint) => {
  switch (action) {
    case 'set':
      if (!provider || !key) {
        console.error('Error: The 'set' action requires a provider and a key.');
        console.log('Example: dalton-cli configure set openai YOUR_KEY_HERE');
        console.log('Example for Azure: dalton-cli configure set azure YOUR_KEY_HERE YOUR_ENDPOINT');
        return;
      }
      setApiKey(provider, key, endpoint);
      break;
    case 'list':
      listApiKeys();
      break;
    default:
      console.error(`Error: Unknown action '${action}'.`);
      console.log("Available actions: 'set', 'list'");
  }
};

module.exports = handleConfigure;