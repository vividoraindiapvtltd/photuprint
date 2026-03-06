/**
 * Restricted deserialize: load template area into canvas, then lock all non-editable objects.
 * Returns editable fields for the UI panel.
 */

import type { TemplateArea } from '../../editor/types';
import type { FabricCanvas, FabricObject, FabricFactory } from '../../editor/lib/fabricCanvas';
import { deserializeToCanvas } from '../../editor/lib/deserialize';

export interface EditableField {
  variableId: string;
  layerId: string;
  type: 'text' | 'image';
  label: string;
  value: string;
  constraints?: any;
}

/**
 * Load template area into canvas, then lock all objects that are NOT editable or have no variableId.
 * Returns editable fields for the UI panel.
 */
export async function restrictedDeserialize(
  canvas: FabricCanvas,
  area: TemplateArea,
  factory: FabricFactory
): Promise<EditableField[]> {
  // Load all objects (use existing deserializeToCanvas)
  await deserializeToCanvas(canvas, area, factory);
  
  const editableFields: EditableField[] = [];
  const objects = canvas.getObjects() as FabricObject[];

  objects.forEach((obj) => {
    const layerId = obj.get?.('layerId') as string;
    const editable = obj.get?.('editable') as boolean;
    const variableId = obj.get?.('variableId') as string | undefined;
    const layerType = obj.get?.('layerType') as string | undefined;

    // Lock if not editable OR no variableId (user can't personalize)
    const shouldLock = !editable || !variableId;

    if (shouldLock) {
      obj.set({
        selectable: false,
        evented: false,
        lockMovementX: true,
        lockMovementY: true,
        lockRotation: true,
        lockScalingX: true,
        lockScalingY: true,
        hoverCursor: 'default',
        moveCursor: 'default',
      });
    } else {
      // Extract editable field info
      const label = variableId!
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase()); // "customer_name" → "Customer Name"
      
      editableFields.push({
        variableId: variableId!,
        layerId: layerId ?? '',
        type: (layerType === 'text' ? 'text' : 'image') as 'text' | 'image',
        label,
        value: layerType === 'text' ? (obj.text as string) ?? '' : (obj._element?.src as string) ?? '',
        constraints: obj.get?.('constraints'),
      });
    }
  });

  // Disable selection on canvas (users edit via panel, not direct selection)
  (canvas as any).selection = false;
  (canvas as any).defaultCursor = 'default';

  return editableFields;
}
