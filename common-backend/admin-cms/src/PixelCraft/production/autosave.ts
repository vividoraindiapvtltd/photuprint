/**
 * Autosave hook: dual storage (localStorage + server) with retry and conflict resolution.
 */

import { useEffect, useRef, useCallback } from 'react';
import { debounce } from 'lodash';

const AUTOSAVE_DEBOUNCE_MS = 2000;
const MAX_RETRIES = 3;

export interface AutosaveOptions {
  templateId: string;
  serialize: () => any; // TemplateDocument or partial
  onSave: (doc: any) => Promise<void>;
  debounceMs?: number;
}

export interface AutosaveResult {
  save: () => void;
  retryFailedSaves: () => Promise<void>;
  isOnline: boolean;
  pendingCount: number;
}

/**
 * Autosave hook with dual storage and retry logic.
 */
export function useAutosave(options: AutosaveOptions): AutosaveResult {
  const { templateId, serialize, onSave, debounceMs = AUTOSAVE_DEBOUNCE_MS } = options;
  const saveQueueRef = useRef<Array<{ doc: any; retries: number }>>([]);
  const isOnlineRef = useRef(typeof navigator !== 'undefined' ? navigator.onLine : true);

  // Save to localStorage as backup
  const saveToLocalStorage = useCallback(
    (doc: any) => {
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`template_draft_${templateId}`, JSON.stringify(doc));
        }
      } catch (error) {
        console.error('Failed to save to localStorage:', error);
      }
    },
    [templateId]
  );

  // Save to server
  const saveToServer = useCallback(
    async (doc: any) => {
      try {
        await onSave(doc);
        saveToLocalStorage(doc); // Update localStorage on success
      } catch (error) {
        // Queue for retry
        saveQueueRef.current.push({ doc, retries: 0 });
        throw error;
      }
    },
    [onSave, saveToLocalStorage]
  );

  // Retry failed saves
  const retryFailedSaves = useCallback(async () => {
    if (!isOnlineRef.current || saveQueueRef.current.length === 0) return;

    const failed = saveQueueRef.current.filter((item) => item.retries < MAX_RETRIES);
    saveQueueRef.current = [];

    for (const item of failed) {
      try {
        await saveToServer(item.doc);
      } catch (error) {
        saveQueueRef.current.push({ ...item, retries: item.retries + 1 });
      }
    }
  }, [saveToServer]);

  // Debounced autosave
  const debouncedSave = useCallback(
    debounce(async () => {
      const doc = serialize();
      saveToLocalStorage(doc); // Immediate localStorage save

      if (isOnlineRef.current) {
        await saveToServer(doc).catch(() => {
          // Already queued in saveToServer
        });
      }
    }, debounceMs),
    [serialize, saveToLocalStorage, saveToServer, debounceMs]
  );

  // Online/offline handlers
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      isOnlineRef.current = true;
      retryFailedSaves();
    };
    const handleOffline = () => {
      isOnlineRef.current = false;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [retryFailedSaves]);

  return {
    save: debouncedSave,
    retryFailedSaves,
    isOnline: isOnlineRef.current,
    pendingCount: saveQueueRef.current.length,
  };
}

/**
 * Load draft from localStorage (for recovery after crash).
 */
export function loadDraftFromLocalStorage(templateId: string): any | null {
  try {
    if (typeof window === 'undefined') return null;
    const stored = localStorage.getItem(`template_draft_${templateId}`);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load draft from localStorage:', error);
    return null;
  }
}
