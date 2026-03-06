/**
 * Unit tests for restricted serialize (user editor).
 */

import { restrictedSerialize } from '../user-editor/lib/restrictedSerialize';
import type { FabricCanvas, FabricObject } from '../editor/lib/fabricCanvas';

describe('Restricted serialize', () => {
  const mockCanvas: FabricCanvas = {
    getObjects: jest.fn(() => [
      {
        type: 'textbox',
        text: 'John Doe',
        get: jest.fn((key: string) => {
          if (key === 'variableId') return 'customer_name';
          if (key === 'editable') return true;
          if (key === 'layerType') return 'text';
          return undefined;
        }),
      } as FabricObject,
      {
        type: 'image',
        _element: { src: 'https://example.com/photo.jpg' } as HTMLImageElement,
        get: jest.fn((key: string) => {
          if (key === 'variableId') return 'photo_1';
          if (key === 'editable') return true;
          if (key === 'layerType') return 'image';
          return undefined;
        }),
      } as FabricObject,
      {
        type: 'rect',
        get: jest.fn((key: string) => {
          if (key === 'variableId') return undefined; // No variableId
          if (key === 'editable') return false;
          return undefined;
        }),
      } as FabricObject,
    ]),
    add: jest.fn(),
    remove: jest.fn(),
    clear: jest.fn(),
    requestRenderAll: jest.fn(),
    dispose: jest.fn(),
    loadFromJSON: jest.fn(),
    toJSON: jest.fn(() => ({})),
  };

  it('should extract only variable values from editable objects', () => {
    const variableValues = restrictedSerialize(mockCanvas);

    expect(variableValues).toEqual({
      customer_name: 'John Doe',
      photo_1: 'https://example.com/photo.jpg',
    });
  });

  it('should exclude non-editable objects', () => {
    const variableValues = restrictedSerialize(mockCanvas);

    // Should not include objects without variableId or editable=false
    expect(variableValues).not.toHaveProperty('rect');
  });

  it('should handle empty canvas', () => {
    const emptyCanvas: FabricCanvas = {
      ...mockCanvas,
      getObjects: jest.fn(() => []),
    };

    const variableValues = restrictedSerialize(emptyCanvas);

    expect(variableValues).toEqual({});
  });
});
