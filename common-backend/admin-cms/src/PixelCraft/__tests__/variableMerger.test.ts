/**
 * Unit tests for variable merger.
 */

import { mergeVariables } from '../render/variableMerger';
import type { TemplateArea } from '../editor/types';

describe('Variable merger', () => {
  const baseArea: TemplateArea = {
    id: 'front',
    label: 'Front',
    canvas: { width: 1000, height: 1000, dpi: 300 },
    layerOrder: ['text1', 'text2', 'img1'],
    layers: {
      text1: {
        id: 'text1',
        type: 'text',
        editable: true,
        order: 0,
        transform: { left: 100, top: 100, width: 200, height: 50 },
        content: 'Default Text',
        variableId: 'greeting',
        style: { fontFamily: 'Arial', fontSize: 24, fill: '#000000' },
      },
      text2: {
        id: 'text2',
        type: 'text',
        editable: false,
        order: 1,
        transform: { left: 100, top: 200, width: 200, height: 50 },
        content: 'Static Text',
        style: { fontFamily: 'Arial', fontSize: 24, fill: '#000000' },
      },
      img1: {
        id: 'img1',
        type: 'image',
        editable: true,
        order: 2,
        transform: { left: 100, top: 300, width: 200, height: 200 },
        src: 'https://example.com/default.jpg',
        variableId: 'photo',
      },
    },
  };

  it('should merge text variable values', () => {
    const variableValues = { greeting: 'Hello World' };
    const merged = mergeVariables(baseArea, variableValues);

    expect(merged.layers.text1.content).toBe('Hello World');
    expect(merged.layers.text2.content).toBe('Static Text'); // No variableId, unchanged
  });

  it('should merge image variable values', () => {
    const variableValues = { photo: 'https://example.com/user-photo.jpg' };
    const merged = mergeVariables(baseArea, variableValues);

    expect(merged.layers.img1.src).toBe('https://example.com/user-photo.jpg');
  });

  it('should handle multiple variables', () => {
    const variableValues = {
      greeting: 'Hello',
      photo: 'https://example.com/photo.jpg',
    };
    const merged = mergeVariables(baseArea, variableValues);

    expect(merged.layers.text1.content).toBe('Hello');
    expect(merged.layers.img1.src).toBe('https://example.com/photo.jpg');
  });

  it('should not modify layers without variableId', () => {
    const variableValues = { greeting: 'Hello' };
    const merged = mergeVariables(baseArea, variableValues);

    expect(merged.layers.text2.content).toBe('Static Text');
  });

  it('should handle empty variable values', () => {
    const merged = mergeVariables(baseArea, {});

    expect(merged.layers.text1.content).toBe('Default Text');
    expect(merged.layers.img1.src).toBe('https://example.com/default.jpg');
  });
});
