// Set environment variables before any module is loaded in each test worker
process.env.API_KEY = 'test-api-key';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test';
