import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

export const GET = async ({ url }) => {
  // Check if we should use mocks
  const useMocks = env.IRIS_USE_MOCKS === '1';
  
  if (useMocks) {
    // Return mock memory vault state
    return json({
      ok: true,
      state: {
        totalMemories: 1024,
        activeThreads: 7,
        lastSync: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
        vaultStatus: 'healthy',
        storage: {
          used: 42 * 1024 * 1024, // 42 MB
          total: 1024 * 1024 * 1024, // 1 GB
          percentage: 4.1
        },
        collections: {
          concepts: 512,
          personas: 8,
          conversations: 64,
          artifacts: 128
        },
        recentActivity: [
          {
            type: 'concept_added',
            timestamp: new Date(Date.now() - 60000).toISOString(),
            details: 'New concept: Quantum coherence'
          },
          {
            type: 'persona_update',
            timestamp: new Date(Date.now() - 180000).toISOString(),
            details: 'Persona evolved: Ghost'
          },
          {
            type: 'memory_indexed',
            timestamp: new Date(Date.now() - 300000).toISOString(),
            details: 'Indexed 42 new memories'
          }
        ]
      },
      isMock: true
    });
  }
  
  // TODO: Connect to real memory vault service
  // For now, return a placeholder indicating real service is not available
  return json({
    ok: false,
    error: 'Memory vault service not configured',
    hint: 'Set IRIS_USE_MOCKS=1 to use mock data'
  }, { status: 503 });
};