"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { getMutations, clearMutation } from '@/lib/offline-db';
import supabase from '@/lib/supabase';

const OfflineContext = createContext({});

export function useOffline() {
  return useContext(OfflineContext);
}

export function OfflineSyncProvider({ children }) {
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    // Initial check
    setIsOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);

    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Conexión restaurada. Sincronizando datos...");
      syncMutations();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning("Sin conexión. Modo offline activado.");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncMutations = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const mutations = await getMutations();
      if (mutations.length === 0) {
        setIsSyncing(false);
        return;
      }

      console.log(`Syncing ${mutations.length} mutations...`);

      for (const item of mutations) {
        const { table, type, data, match, rpc } = item;
        let error = null;

        try {
            if (rpc) {
                const res = await supabase.rpc(table, data); // 'table' acts as function name here
                error = res.error;
            } else {
                let query = supabase.from(table);
                
                if (type === 'INSERT') {
                    const res = await query.insert(data);
                    error = res.error;
                } else if (type === 'UPDATE') {
                    const res = await query.update(data).match(match || {});
                     error = res.error;
                } else if (type === 'DELETE') {
                    const res = await query.delete().match(match || {});
                     error = res.error;
                }
            }
            
            if (error) throw error;
            
            // Success, remove from queue
            await clearMutation(item.id);

        } catch (err) {
            console.error("Failed to sync item", item, err);
            // If it's a persistent error (not network), maybe we should move it to a 'dead letter queue' 
            // but for now we leave it to retry or manual intervention logic could be added
        }
      }
      
      const setRemaining = await getMutations();
      if (setRemaining.length === 0) {
          toast.success("Sincronización completada exitosamente.");
      } else {
          toast.info(`Quedan ${setRemaining.length} elementos pendientes de sincronizar.`);
      }

    } catch (error) {
      console.error("Sync generic error:", error);
      toast.error("Error al sincronizar algunos datos.");
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <OfflineContext.Provider value={{ isOnline, isSyncing, syncMutations }}>
      {children}
    </OfflineContext.Provider>
  );
}
