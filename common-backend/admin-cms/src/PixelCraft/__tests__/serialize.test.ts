/**
 * Unit tests for template serialization.
 * Run with: npm test -- serialize.test.ts
 */

import { serializeCanvas } from '../editor/lib/serialize';
import type { TemplateArea } from '../editor/types';
import type { FabricCanvas, FabricObject } from '../editor/lib/fabricCanvas';

// Mock Fabric.js
const mockCanvas: FabricCanvas = {
  getObjects: jest.fn(() => [
    {
      type: 'textbox',
      left: 100,
      top: 100,
      width: 200,
      height: 50,
      scaleX: 1,
      scaleY: 1,
      angle: 0,
      originX: 'left',
      originY: 'top',
      text: 'Hello',
      fontFamily: 'Arial',
      fontSize: 24,
      fontWeight: 'normal',
      fontStyle: 'normal',
      textAlign: 'left',
      fill: '#000000',
      get: jest.fn((key: string) => {
        if (key === 'layerId') return 'text1';
        if (key === 'editable') return true;
        if (key === 'variableId') return 'greeting';
        if (key === 'layerType') return 'text';
        return undefined;
      }),
      name: 'text1',
      uid: 'uid1',
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

describe('Template serialization', () => {
  it('should serialize canvas to TemplateArea', () => {
    const area = serializeCanvas(
      mockCanvas,
      'front',
      'Front',
      { width: 1000, height: 1000, dpi: 300 }
    );

    expect(area.id).toBe('front');
    expect(area.label).toBe('Front');
    expect(area.canvas.width).toBe(1000);
    expect(area.canvas.height).toBe(1000);
    expect(area.canvas.dpi).toBe(300);
    expect(area.layerOrder).toContain('text1');
    expect(area.layers.text1).toBeDefined();
    expect(area.layers.text1.type).toBe('text');
    expect(area.layers.text1.content).toBe('Hello');
    expect(area.layers.text1.variableId).toBe('greeting');
    expect(area.layers.text1.editable).toBe(true);
  });

  it('should handle empty canvas', () => {
    const emptyCanvas: FabricCanvas = {
      ...mockCanvas,
      getObjects: jest.fn(() => []),
    };

    const area = serializeCanvas(emptyCanvas, 'front', 'Front', { width: 1000, height: 1000, dpi: 300 });

    expect(area.layerOrder).toEqual([]);
    expect(Object.keys(area.layers)).toHaveLength(0);
  });
});
