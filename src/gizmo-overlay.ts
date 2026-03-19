// Gizmo overlay for interactive 3D manipulation
// Provides handles for rotating, scaling, and moving objects

export function createGizmoOverlayController() {
  return {
    updateTransform() {
      // Gizmo transform update
    },
    handleDrag() {
      // Drag handling for gizmo  
    },
  };
}

export type GizmoMode = 'translate' | 'rotate' | 'scale';

export interface GizmoState {
  mode: GizmoMode;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: number;
}
