import dotenv from 'dotenv';

dotenv.config();

const config = {
  port: parseInt(process.env.PORT || '8030', 10),
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/zebra-bu-mapping',
  apiKey: process.env.API_KEY || 'default-dev-api-key',
  azure: {
    tenantId: process.env.AZURE_TENANT_ID || '',
    clientId: process.env.AZURE_CLIENT_ID || '',
    clientSecret: process.env.AZURE_CLIENT_SECRET || '',
  },
  graphApiBaseUrl: process.env.GRAPH_API_BASE_URL || 'https://graph.microsoft.com/v1.0',
  nodeEnv: process.env.NODE_ENV || 'development',
};

export default config;
