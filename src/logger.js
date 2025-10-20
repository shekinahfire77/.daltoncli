const { getTimestamp } = require('./utils');

const log = (level, message) => {
  console.log(`[${getTimestamp()}] [${level.toUpperCase()}] ${message}`);
};

const info = (message) => log('info', message);
const error = (message) => log('error', message);
const warn = (message) => log('warn', message);

module.exports = { info, error, warn };
