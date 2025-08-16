import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const GET = async ({ url }) => {
  // Check if we should use mocks
  const useMocks = env.IRIS_USE_MOCKS === '1';
  
  if (useMocks) {
    // Return mock PDF statistics
    return json({
      ok: true,
      stats: {
        totalProcessed: 42,
        totalPages: 1337,
        averageProcessingTime: 2.4,
        lastProcessed: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        extractedConcepts: 256,
        documentTypes: {
          research: 18,
          technical: 12,
          report: 8,
          other: 4
        },
        processingQueue: 3,
        failedProcessing: 0
      },
      isMock: true
    });
  }
  
  // TODO: Connect to real PDF processing service
  // For now, return a placeholder indicating real service is not available
  return json({
    ok: false,
    error: 'PDF processing service not configured',
    hint: 'Set IRIS_USE_MOCKS=1 to use mock data'
  }, { status: 503 });
};