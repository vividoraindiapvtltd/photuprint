/**
 * Variable merger: inject user variable values into template area layers.
 * Updates layer.content (text) or layer.src (image) for layers with matching variableId.
 */

import type { TemplateArea, TemplateLayer, TextLayer, ImageLayer } from '../editor/types';

/**
 * Merge user variable values into template area layers.
 * Updates layer.content (text) or layer.src (image) for layers with matching variableId.
 */
export function mergeVariables(
  area: TemplateArea,
  variableValues: Record<string, string>
): TemplateArea {
  const mergedLayers: Record<string, TemplateLayer> = {};

  Object.entries(area.layers).forEach(([layerId, layer]) => {
    const variableId = layer.variableId;

    if (variableId && variableValues[variableId]) {
      // Clone layer and update with user value
      const mergedLayer = { ...layer };

      if (layer.type === 'text') {
        (mergedLayer as TextLayer).content = variableValues[variableId];
      } else if (layer.type === 'image') {
        (mergedLayer as ImageLayer).src = variableValues[variableId];
      }

      mergedLayers[layerId] = mergedLayer;
    } else {
      // Keep original layer (no variable or no user value)
      mergedLayers[layerId] = layer;
    }
  });

  return {
    ...area,
    layers: mergedLayers,
  };
}
