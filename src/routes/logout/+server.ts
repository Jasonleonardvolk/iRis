import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002';

export const GET: RequestHandler = async ({ cookies, fetch }) => {
  // Get session token before clearing
  const session = cookies.get('session');
  
  // Optional: Notify backend about logout
  if (session) {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session}`,
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
    } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
      // Backend logout failed, but we'll clear cookies anyway
      console.error('Backend logout error:', error);
    
}
  }
  
  // Clear all auth-related cookies
  cookies.delete('session', { path: '/' });
  cookies.delete('username', { path: '/' });
  cookies.delete('role', { path: '/' });
  
  // Redirect to login page
  throw redirect(303, '/login');
};
