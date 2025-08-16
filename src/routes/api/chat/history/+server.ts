import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';

/**
 * GET /api/chat/history
 * Returns recent chat history for the current user
 */
export const GET: RequestHandler = async ({ locals, request, url }) => {
  const userId = locals.user?.id || request.headers.get('X-User-Id');
  
  if (!userId) {
    return json({
      success: false,
      error: 'User ID required'
    }, { status: 401 });
  }
  
  // Parse query parameters
  const limit = parseInt(url.searchParams.get('limit') || '10');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  try {
    // Try to fetch chat history from backend
    const response = await fetch(
      `${BACKEND_URL}/api/chat/history/${userId}?limit=${limit}&offset=${offset}`,
      {
        headers: {
          'X-User-Id': userId,
          'X-Request-Source': 'svelte-ui'
        }
      }
    );
    
    if (response.ok) {
      const data = await response.json();
      
      // Ensure history is an array
      const history = Array.isArray(data.history) ? data.history : [];
      
      // Enhance history entries with frontend metadata
      const enhancedHistory = history.map((session: any) => ({
        session_id: session.session_id || session.id || generateSessionId(),
        timestamp: session.timestamp || session.created_at || new Date().toISOString(),
        persona: session.persona || session.ghost_persona || 'Default',
        message_count: session.message_count || session.messages?.length || 0,
        concepts: session.concepts || session.extracted_concepts || [],
        type: session.type || (session.has_documents ? 'document' : 'chat'),
        has_documents: session.has_documents || false,
        metadata: {
          ...session.metadata,
          source: 'backend'
        }
      }));
      
      return json({
        success: true,
        history: enhancedHistory,
        total: data.total || enhancedHistory.length,
        limit,
        offset
      });
      
    } else {
      console.error('Chat history backend error:', response.status);
      
      // Return empty history on backend error
      return json({
        success: true,
        history: [],
        total: 0,
        limit,
        offset,
        error: 'Backend unavailable'
      });
    }
  } catch (error) {
    console.error('Chat history fetch error:', error);
    
    // Return empty history on complete failure
    return json({
      success: true,
      history: [],
      total: 0,
      limit,
      offset,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

/**
 * Generate a session ID if none exists
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `session-${timestamp}-${random}`;
}
