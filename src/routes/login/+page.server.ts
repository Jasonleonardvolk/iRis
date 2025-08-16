import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

// Use environment variable or default to port 8002
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8002';

export const actions: Actions = {
  default: async ({ request, cookies, fetch }) => {
    const data = await request.formData();
    const username = data.get('username')?.toString()?.trim();
    const password = data.get('password')?.toString();
    
    // Validate input
    if (!username || !password) {
      return fail(400, { 
        error: 'Username and password are required' 
      });
    }
    
    try {
      // Call backend OAuth API
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ username, password }),
        credentials: 'include' // Important for CORS and cookies
      });
      
      if (!res.ok) {
        // Handle error response
        let errorMsg = 'Invalid credentials';
        try {
          const errorData = await res.json();
          errorMsg = errorData.detail || errorData.message || errorMsg;
        } catch {
          const text = await res.text();
          if (text) errorMsg = text;
        }
        
        return fail(res.status, { 
          error: errorMsg 
        });
      }
      
      // Parse successful response
      const responseData = await res.json();
      
      // Backend returns JWT token in JSON body
      // We need to manually set it as an HTTP-only cookie
      if (responseData.token) {
        cookies.set('session', responseData.token, {
          path: '/',
          httpOnly: true,
          secure: false, // Use true in production with HTTPS
          sameSite: 'lax', // Allow same-site requests
          maxAge: 60 * 60 * 24 * 7 // 7 days
        });
        
        // Also store user info for quick access
        if (responseData.user) {
          cookies.set('username', responseData.user.username || username, {
            path: '/',
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 7
          });
          
          if (responseData.user.role) {
            cookies.set('role', responseData.user.role, {
              path: '/',
              httpOnly: true,
              secure: false,
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 7
            });
          }
        }
      } else if (res.headers.get('set-cookie')) {
        // Backend set cookie directly (future implementation)
        // SvelteKit will forward it automatically
        console.log('Backend set session cookie directly');
      } else {
        // No token received
        return fail(500, { 
          error: 'No authentication token received from server' 
        });
      }
      
      // Successful login - redirect to main app
      throw redirect(303, '/');
      
    } catch (error) {
  const msg = error instanceof Error ? error.message : String(error);
      // Handle redirect (not an error)
      if (error instanceof Response && error.status === 303) {
        throw error;
      
}
      
      console.error('Login error:', error);
      
      // Network or other errors
      return fail(500, { 
        error: 'Unable to connect to authentication server. Please try again.' 
      });
    }
  }
};
