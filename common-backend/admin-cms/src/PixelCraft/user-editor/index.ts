/**
 * PixelCraft User Personalization Editor
 * Restricted editing: only editable fields (variableId + editable: true) can be changed.
 */

export * from './lib/restrictedDeserialize';
export * from './lib/restrictedSerialize';
export * from './lib/validateConstraints';
export * from './hooks/useImageUpload';

export type { EditableField } from './lib/restrictedDeserialize';
