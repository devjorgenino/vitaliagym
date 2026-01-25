import client from "@/api/client";

/**
 * Get the current access token from Supabase session
 * @returns {Promise<string|null>}
 */
export async function getAccessToken() {
  try {
    const { data: { session } } = await client.auth.getSession();
    return session?.access_token || null;
  } catch (error) {
    console.error("Error getting access token:", error);
    return null;
  }
}

/**
 * Make an authenticated JSON POST request
 * Sends the auth token in the request body to avoid 431 header size errors
 * 
 * @param {string} url - The URL to fetch
 * @param {object} data - The data to send as JSON
 * @returns {Promise<{ok: boolean, data?: any, error?: string, status: number}>}
 */
export async function authPost(url, data) {
  try {
    const token = await getAccessToken();
    
    // Include token in the body instead of headers to avoid 431 errors
    const bodyWithAuth = {
      ...data,
      _authToken: token,
    };
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyWithAuth),
    });
    
    const contentType = response.headers.get("content-type");
    let result = null;
    
    if (contentType?.includes("application/json")) {
      result = await response.json();
    }
    
    if (!response.ok) {
      return {
        ok: false,
        error: result?.error || `Error ${response.status}`,
        status: response.status,
      };
    }
    
    return {
      ok: true,
      data: result,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      status: 0,
    };
  }
}

/**
 * Make an authenticated DELETE request
 * Uses POST method with _action: "delete" and token in body to avoid 431 header size errors
 * 
 * @param {string} url - The URL to fetch
 * @param {object} data - Additional data to send (e.g., { userId: "..." })
 * @returns {Promise<{ok: boolean, data?: any, error?: string, status: number}>}
 */
export async function authDelete(url, data = {}) {
  try {
    const token = await getAccessToken();
    
    // Send as POST with action flag and token in body
    const bodyWithAuth = {
      ...data,
      _authToken: token,
      _action: "delete",
    };
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(bodyWithAuth),
    });
    
    const contentType = response.headers.get("content-type");
    let result = null;
    
    if (contentType?.includes("application/json")) {
      result = await response.json();
    }
    
    if (!response.ok) {
      return {
        ok: false,
        error: result?.error || `Error ${response.status}`,
        status: response.status,
      };
    }
    
    return {
      ok: true,
      data: result,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      status: 0,
    };
  }
}
