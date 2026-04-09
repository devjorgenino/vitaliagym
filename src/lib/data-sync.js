import { saveMutation, getMutations, clearMutation } from './offline-db';
import client from '@/api/client'; // Assuming client is the default export from @/api/client or ../api/client

// We export this so the UI can listen to sync events or trigger manual sync
export async function syncPendingData() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
        console.log("Cannot sync, device offline.");
        return;
    }

    const mutations = await getMutations();
    if (mutations.length === 0) return;

    console.log(`Syncing ${mutations.length} pending mutations...`);

    for (const mutation of mutations) {
        try {
            const { table, type, data, match, rpc, id } = mutation;
            let result = { error: null };

            // We must skip if dependencies might be missing? 
            // For simple CRUD, usually fine. 
            // Complex dependencies might require topological sort or sequential processing.
            // Since we use autoIncrement ID in local DB, getAll returns detailed order.
            
            if (rpc) {
                result = await client.rpc(table, data);
            } else if (type === 'AUTH_UPDATE') {
                // Special case for auth user metadata update
                const { data: updateData } = data; // structure we pass to executeWithSync is usually data: { data: metadata }
                const { data: userData, error } = await client.auth.updateUser({ data: updateData });
                result = { data: userData, error };
            } else {
                const query = client.from(table);
                if (type === 'INSERT') {
                    // We remove temp ID if present and created locally?
                    // For now assuming data is clean.
                    result = await query.insert(data).select();
                } else if (type === 'UPDATE') {
                    result = await query.update(data).match(match).select();
                } else if (type === 'DELETE') {
                    result = await query.delete().match(match).select();
                }
            }

            if (result.error) {
                console.error(`Failed to sync mutation ${id}:`, result.error);
                // If it's a permanent error (constraint violation), maybe we should discard it?
                // If network error, we stop syncing and keep it.
                if (result.error.message?.includes('fetch') || result.error.message?.includes('Network')) {
                    throw new Error('Sync network error');
                }
                // If other error, we might remove it to avoid blocking queue forever, 
                // OR we flag it. For now, we remove it to unblock.
                console.warn(`Removing problematic mutation ${id} from queue.`);
                await clearMutation(id);
            } else {
                console.log(`Synced mutation ${id} successfully.`);
                await clearMutation(id);
            }
            
        } catch (err) {
            console.warn("Sync process interrupted:", err);
            break; // Stop syncing if network fails
        }
    }
}

/**
 * Execute a Supabase operation with offline fallback.
 * If the device is offline or the request fails due to network, 
 * the operation is queued in IndexedDB.
 */
export async function executeWithSync({ table, type, data, match, rpc }) {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // Helper to ensure return shape resembles Supabase { data: [obj], error: null }
  const mockSuccess = (payload) => {
      // Supabase insert/select returns array.
      // If we are deleting, payload might be empty or checking the deleted rows.
      // If we are updating, it is the updated data.
      // If we are inserting, it is the inserted data.
      
      // We must try to return an array if data is an object
      let responseData = payload;
      if (payload && !Array.isArray(payload)) {
          responseData = [payload];
      } else if (!payload) {
          responseData = null; // or []
      }
      return { data: responseData, error: null, isOfflineResult: true };
  };

  if (!isOnline) {
    console.log("Device offline, saving mutation to queue...");
    await saveMutation({ table, type, data, match, rpc });
    return mockSuccess(data);
  }

  try {
    let result;
    
    if (rpc) {
        result = await client.rpc(table, data);
    } else if (type === 'AUTH_UPDATE') {
        const { data: updateData } = data;
        const { data: userData, error } = await client.auth.updateUser({ data: updateData });
        result = { data: userData, error };
    } else {
        const query = client.from(table);
        if (type === 'INSERT') {
            result = await query.insert(data).select();
        } else if (type === 'UPDATE') {
            result = await query.update(data).match(match).select();
        } else if (type === 'DELETE') {
            result = await query.delete().match(match).select();
        }
    }

    if (result.error) {
        // If query error (e.g. valid constraint), DO NOT fallback to usage.
        // Falls back ONLY on connection error.
        const msg = result.error.message || '';
        if (msg.includes('fetch') || msg.includes('Network') || msg.includes('connection')) {
             throw new Error('Network error during request');
        }
        return result; 
    }

    return result;

  } catch (err) {
    console.warn("Network request failed, falling back to offline queue:", err);
    await saveMutation({ table, type, data, match, rpc });
    return mockSuccess(data);
  }
}
