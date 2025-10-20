// Mock implementation of keytar for testing
module.exports = {
  getPassword: jest.fn(),
  setPassword: jest.fn(),
  deletePassword: jest.fn(),
};
