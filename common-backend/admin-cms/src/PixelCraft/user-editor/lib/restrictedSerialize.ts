/**
 * Restricted serialize: extract only variable values from canvas (not full template JSON).
 * Returns { variableId: value } for saving to cart/order.
 */

import type { FabricCanvas, FabricObject } from '../../editor/lib/fabricCanvas';

/**
 * Extract only variable values from canvas (not full template JSON).
 * Returns { variableId: value } for saving to cart/order.
 */
export function restrictedSerialize(canvas: FabricCanvas): Record<string, string> {
  const objects = canvas.getObjects() as FabricObject[];
  const variableValues: Record<string, string> = {};

  objects.forEach((obj) => {
    const variableId = obj.get?.('variableId') as string | undefined;
    const editable = obj.get?.('editable') as boolean;
    const layerType = obj.get?.('layerType') as string | undefined;

    if (variableId && editable) {
      if (layerType === 'text') {
        variableValues[variableId] = (obj.text as string) ?? '';
      } else if (layerType === 'image') {
        // Store image URL or asset key (from upload)
        variableValues[variableId] = (obj._element?.src as string) ?? '';
      }
    }
  });

  return variableValues;
}
