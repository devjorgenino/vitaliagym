import { initDB } from './offline-db';

export async function saveQueryCache(key, data) {
  const db = await initDB();
  return db.put('queries', {
    key,
    data,
    timestamp: Date.now()
  });
}

export async function getQueryCache(key) {
  const db = await initDB();
  return db.get('queries', key);
}

/**
 * Execute a fetch operation with offline fallback support.
 * @param {string} key - Unique key for caching this query result
 * @param {Function} fetcher - Async function that returns the Supabase response { data, error }
 * @returns {Promise<{data: any, error: any}>}
 */
export async function fetchWithOffline(key, fetcher) {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isOnline) {
    try {
      const response = await fetcher();
      
      // If there is an error
      if (response.error) {
         // Check if it's a connection error likely (Failed to fetch, NetworkError, etc)
         const msg = response.error.message || '';
         const isNetworkError = msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('connection');
         
         if (isNetworkError) {
             console.warn(`Online fetch returned network error for ${key}, falling back to cache...`);
             // Fallthrough to offline cache check below
         } else {
             // It is a real API error (e.g. permission denied, table not found), return it
             return response;
         }
      } else {
         // Success case (data might be null or [], but no error)
         // Only cache if data is defined (Supabase returns null data on error usually, but here checking error is enough)
         // However, Supabase .single() returns data: null on 0 rows which is not an error if maybeSingle is used, but is error otherwise.
         // Let's assume if !error, it is cacheable.
         if (response.data !== undefined) {
            await saveQueryCache(key, response.data);
         }
         return response;
      }
    } catch (err) {
      console.warn(`Online fetch threw exception for ${key}, falling back to cache...`, err);
      // Fallthrough to offline cache check
    }
  }

  // Offline or fetch failed: Try cache
  const cached = await getQueryCache(key);
  if (cached) {
    console.log(`Served ${key} from offline cache`);
    // Return cached data with no error
    return { data: cached.data, error: null };
  }
  
  // If we are here, we are offline/failed fetch AND no cache exists.
  // We must return an error so the UI knows.
  // BUT, returning a generic error causes the "Error: ..." screen.
  // If we want to show empty state instead of error, we could return { data: [], error: null } for lists?
  // But we don't know if it is a list or object.
  // Better to return error and handle it in UI gracefully? 
  // The user complains about "Error con boton reintentar".
  
  return { 
      data: null, 
      error: { 
          message: 'Sin conexión y sin datos locales.',
          code: 'OFFLINE_NO_CACHE'
      } 
  };
}
