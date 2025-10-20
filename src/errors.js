class CLIError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CLIError';
  }
}

class APIError extends CLIError {
  constructor(message) {
    super(message);
    this.name = 'APIError';
  }
}

class ConfigError extends CLIError {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

module.exports = { CLIError, APIError, ConfigError };
