import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

const startTime = Date.now();

export const GET = async () => {
  const uptime = Date.now() - startTime;
  const status = {
    status: 'healthy',
    uptime: uptime,
    timestamp: new Date().toISOString(),
    version: '0.1.0',
    environment: {
      port: env.PORT || '3000',
      allowUnauth: env.IRIS_ALLOW_UNAUTH === '1',
      useMocks: env.IRIS_USE_MOCKS === '1',
      storageType: env.STORAGE_TYPE || 'local'
    }
  };
  
  return json(status);
};