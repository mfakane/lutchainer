# UI Regression Checklist

This checklist is for manual verification of the highest-risk UI flows.

## Preconditions

1. Run `npm run build`.
2. Run `npm run serve`.
3. Open `http://localhost:8000`.

## Shader Dialog

1. Click `Open Code` in the header.
2. Verify the dialog opens and shows shader code.
3. Switch tabs: GLSL Fragment, GLSL Vertex, HLSL, MMEffect.
4. Verify the code area updates for each tab.
5. Click `Copy` and verify success status appears.
6. Click `Export` and verify the export flow completes.
7. Press `Esc` and verify the dialog closes.

## Header Actions

1. Toggle `Auto Apply` on and off.
2. Verify `Apply` works when Auto Apply is off.
3. Click `Undo` and `Redo` after a pipeline change.
4. Verify undo/redo button enabled states update correctly.
5. Click `Load` and import a `.lutchain` example.
6. Click `Save` and verify export succeeds.

## Preview Shape Bar

1. Switch shape: Sphere -> Cube -> Torus -> Sphere.
2. Open the shape action menu.
3. Toggle wireframe and verify preview changes.
4. Execute `Export 3D Preview PNG`.
5. Execute `Export Step Preview PNG`.

## LUT / Step Drag-and-Drop

1. Reorder LUT cards in the LUT strip.
2. Reorder steps in the step list.
3. Drag from a param socket to a step socket and verify connection line updates.
4. Drag from a custom param socket to both X and Y step sockets.
5. Start drag and cancel outside the drop target; verify no stale highlight remains.

## Failure Checks

1. Try loading an invalid file and verify an error status appears.
2. Try export actions while dialog is closed and confirm no crash occurs.
3. Try repeated open/close of shader dialog (10+ times) and verify interaction remains stable.