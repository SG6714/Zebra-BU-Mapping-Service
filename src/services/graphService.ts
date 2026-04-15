import { ConfidentialClientApplication } from '@azure/msal-node';
import axios from 'axios';
import config from '../config';
import logger from '../utils/logger';

interface ManagerInfo {
  email: string;
  displayName: string;
  jobTitle: string;
}

let msalClient: ConfidentialClientApplication | null = null;

function getMsalClient(): ConfidentialClientApplication | null {
  if (!config.azure.tenantId || !config.azure.clientId || !config.azure.clientSecret) {
    return null;
  }

  if (!msalClient) {
    msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: config.azure.clientId,
        clientSecret: config.azure.clientSecret,
        authority: `https://login.microsoftonline.com/${config.azure.tenantId}`,
      },
    });
  }

  return msalClient;
}

async function getAccessToken(): Promise<string | null> {
  const client = getMsalClient();
  if (!client) return null;

  try {
    const result = await client.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });
    return result?.accessToken || null;
  } catch (error) {
    logger.error('Failed to acquire access token:', error);
    return null;
  }
}

export async function getManagerChain(email: string): Promise<ManagerInfo[]> {
  const token = await getAccessToken();
  if (!token) {
    logger.warn('Azure credentials not configured, skipping Graph API call');
    return [];
  }

  const chain: ManagerInfo[] = [];
  let currentEmail = email;
  const maxLevels = 5;

  for (let i = 0; i < maxLevels; i++) {
    try {
      const response = await axios.get(
        `${config.graphApiBaseUrl}/users/${encodeURIComponent(currentEmail)}/manager`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { $select: 'mail,displayName,jobTitle' },
        }
      );

      const manager = response.data;
      const managerEmail = manager.mail || manager.userPrincipalName;

      if (!managerEmail) break;

      chain.push({
        email: managerEmail,
        displayName: manager.displayName || '',
        jobTitle: manager.jobTitle || '',
      });

      currentEmail = managerEmail;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        break; // No manager found
      }
      logger.error('Graph API error:', error);
      break;
    }
  }

  return chain;
}
