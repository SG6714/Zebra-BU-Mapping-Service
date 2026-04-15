module.exports = async () => {
  process.env.API_KEY = 'test-api-key';
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
};
