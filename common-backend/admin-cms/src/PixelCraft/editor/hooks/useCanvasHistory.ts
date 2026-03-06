/**
 * Undo/redo for Fabric canvas using full canvas.toJSON() / loadFromJSON().
 * Push state before changes; pop on undo and restore.
 */

import { useCallback, useRef, useState } from 'react';
import type { FabricCanvas } from '../lib/fabricCanvas';

const MAX_HISTORY = 50;

export function useCanvasHistory(canvas: FabricCanvas | null) {
  const historyRef = useRef<object[]>([]);
  const redoStackRef = useRef<object[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const push = useCallback(() => {
    if (!canvas) return;
    const json = canvas.toJSON(['layerId', 'editable', 'variableId', 'layerType']);
    historyRef.current = historyRef.current.slice(-(MAX_HISTORY - 1));
    historyRef.current.push(json);
    redoStackRef.current = [];
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(false);
  }, [canvas]);

  const undo = useCallback(() => {
    if (!canvas || historyRef.current.length === 0) return;
    const current = canvas.toJSON(['layerId', 'editable', 'variableId', 'layerType']);
    redoStackRef.current.push(current);
    const prev = historyRef.current.pop();
    if (prev) {
      canvas.loadFromJSON(prev, () => canvas.requestRenderAll());
    }
    setCanUndo(historyRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
  }, [canvas]);

  const redo = useCallback(() => {
    if (!canvas || redoStackRef.current.length === 0) return;
    const current = canvas.toJSON(['layerId', 'editable', 'variableId', 'layerType']);
    historyRef.current.push(current);
    const next = redoStackRef.current.pop();
    if (next) {
      canvas.loadFromJSON(next, () => canvas.requestRenderAll());
    }
    setCanUndo(true);
    setCanRedo(redoStackRef.current.length > 0);
  }, [canvas]);

  const clear = useCallback(() => {
    historyRef.current = [];
    redoStackRef.current = [];
    setCanUndo(false);
    setCanRedo(false);
  }, []);

  return { push, undo, redo, clear, canUndo, canRedo };
}
