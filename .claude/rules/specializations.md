# specializations.md — WebGL、GPU、Interaction の詳細

本ドキュメントは、LUT Chainer における特殊分野（グラフィックス、インタラクション、I/O）の技術詳細を記載します。

## 1. WebGL & Shader Generation

### Shader Architecture

#### Flow: Pipeline → GLSL Fragment Code

```
Pipeline Model:
  steps: [
    { lut: img1.png, blendMode: 'multiply', params: {x: 'posX', y: 'posY'} },
    { lut: img2.png, blendMode: 'screen', params: {x: 'meshZ', y: 'normalY'} },
  ]
  ↓
buildShaderFromPipeline(pipeline)
  ↓
GLSL Fragment Shader:
  uniform sampler2D lut0, lut1;
  uniform vec3 baseColor;
  varying vec2 vUv;
  varying vec3 vNormal;
  void main() {
    vec4 color = vec4(baseColor, 1.0);
    
    // Step 1: Sample lut0 at (posX, posY)
    vec2 uv0 = vec2(posX, posY);
    vec4 lutColor0 = texture(lut0, uv0);
    color.rgb = mix(color.rgb, lutColor0.rgb, 0.5);  // multiply
    
    // Step 2: Sample lut1 at (meshZ, normalY)
    vec2 uv1 = vec2(meshZ, normalY);
    vec4 lutColor1 = texture(lut1, uv1);
    color.rgb = color.rgb + lutColor1.rgb * (1.0 - color.rgb);  // screen
    
    gl_FragColor = color;
  }
```

### Source Files

| File | Role |
|------|------|
| [shader-generator.ts](../../src/features/shader/shader-generator.ts) | Main entry; 引数`ShaderBuildInput` → GLSL fragment code return |
| [shader-local-decls.ts](../../src/features/shader/shader-local-decls.ts) | Uniform + sampler declarations生成 |
| [shader-step-code.ts](../../src/features/shader/shader-step-code.ts) | Per-step composition code 生成 |

### ShaderBuildInput Type

```typescript
// src/features/shader/types.ts
export interface ShaderBuildInput {
  steps: StepRuntimeModel[];  // Chain to compile
  material: MaterialSettings; // Base color, specular, etc.
  light: LightSettings;       // Light direction
  outputStage: 'fragment' | 'vertex' | 'hlsl';
}

export interface MaterialSettings {
  baseColor: [number, number, number];
  ambientColor: [number, number, number];
  diffuse: number;
  specular: number;
  specularPower: number;
  fresnel: number;
  fresnelPower: number;
}
```

### Sampler Binding

```typescript
// src/shared/rendering/lut-texture-utils.ts
export interface ApplyLutTexturesOptions {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  luts: LutModel[];  // Array of LUT images
  maxTextureUnits: number;  // gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS)
}

export function applyLutTextures(options: ApplyLutTexturesOptions): ApplyLutTexturesResult {
  // For each LUT:
  // 1. Create WebGLTexture from image pixel data
  // 2. Bind to texture unit (0, 1, 2, ...)
  // 3. Set uniform sampler (lutSampler0, lutSampler1, ...)
  
  // Return: { success: true, textureIds } or { success: false, errors: [...] }
}
```

### Shader Stage Types

```typescript
export type ShaderStage = 'fragment' | 'vertex' | 'hlsl';

// Same composition logic, different output syntax:
// - 'fragment': GLSL fragment shader
// - 'vertex': GLSL vertex processing (less common for LUT chaining)
// - 'hlsl': DirectX HLSL syntax
```

---

## 2. Texture & LUT Management

### LUT Model Structure

```typescript
// src/features/step/step-model.ts
export interface LutModel {
  id: string;  // UUID
  label: string;
  width: number;  // Texture dimensions (usually 256×256 or 512×512)
  height: number;
  imageData: Uint8ClampedArray;  // Raw pixel data RGBA
  dataUrl?: string;  // data:image/png;base64,... (for export)
}
```

### Texture Unit Limits

**Critical**: WebGL 1.0 has strict texture unit limits.

```typescript
// Good practice
const maxUnits = gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS);  // Usually 8-16
if (luts.length > maxUnits) {
  // ❌ Error: too many LUTs to bind simultaneously
  return { success: false, errors: [`Exceeded max texture units: ${luts.length} > ${maxUnits}`] };
}
```

### Texture Unit Binding Order

```typescript
// src/shared/rendering/lut-texture-utils.ts
for (let i = 0; i < luts.length; i++) {
  const unit = gl.TEXTURE0 + i;
  
  gl.activeTexture(unit);  // Select texture unit i
  
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  
  // Set pixel data
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    lut.width,
    lut.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    lut.imageData,
  );
  
  // Linear filtering (important for color accuracy)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  
  // Clamp to edge（no wrapping）
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  
  // Set uniform sampler (e.g., lutSampler0, lutSampler1)
  const uniformLoc = gl.getUniformLocation(program, `lutSampler${i}`);
  gl.uniform1i(uniformLoc, i);  // Bind to unit i
}
```

### CPU Fallback: Texel-Center Mapping (Critical!)

WebGL uses hardware linear filtering with texel-center sampling. CPU must replicate exactly.

```typescript
// ❌ WRONG: u * (width - 1) causes color mismatch
const uPixel = u * lut.width;  // u ∈ [0, 1]
const vPixel = v * lut.height;
const texelIndex = Math.floor(uPixel) + Math.floor(vPixel) * lut.width;
const color = readPixel(lut.imageData, texelIndex);  // ❌ nearest, not linear

// ✅ CORRECT: Texel-center mapping + bilinear interpolation
const uPixel = u * lut.width - 0.5;  //(0.5, width - 0.5)
const vPixel = v * lut.height - 0.5;
const x0 = Math.floor(uPixel);
const x1 = Math.min(x0 + 1, lut.width - 1);
const y0 = Math.floor(vPixel);
const y1 = Math.min(y0 + 1, lut.height - 1);

const fx = uPixel - x0;  // Fractional part
const fy = vPixel - y0;

const c00 = readPixel(x0, y0);
const c10 = readPixel(x1, y0);
const c01 = readPixel(x0, y1);
const c11 = readPixel(x1, y1);

// Bilinear blend
const c0 = blend(c00, c10, fx);
const c1 = blend(c01, c11, fx);
return blend(c0, c1, fy);
```

**Reference**: [lut-sampling.ts](../../src/features/step/lut-sampling.ts)

---

## 3. Rendering System & Main Loop

### RenderSystem Lifecycle

```typescript
// src/shared/rendering/render-system.ts
export interface CreateRenderSystemOptions {
  canvas: HTMLCanvasElement;
  renderer: Renderer;
  getPipelineSteps: () => StepModel[];
  getLutModels: () => LutModel[];
  getCameraOrbit: () => CameraOrbit;
  getMaterialSettings: () => MaterialSettings;
  getLightSettings: () => LightSettings;
}

export function createRenderSystem(
  options: CreateRenderSystemOptions,
): RenderSystemController {
  let animationFrameId: number | null = null;

  function loop(time: DOMHighResTimeStamp) {
    const steps = options.getPipelineSteps();
    const material = options.getMaterialSettings();
    const light = options.getLightSettings();
    const orbit = options.getCameraOrbit();

    // Update shader if steps changed
    options.renderer.setShaderFromPipeline(steps);
    
    // Calculate light direction from orbit
    const lineDirection = calculateLineDirection(light.azimuth, light.elevation);

    // Draw frame
    options.renderer.draw(lineDirection, material, options.getLutModels());

    // Continue loop
    animationFrameId = requestAnimationFrame(loop);
  }

  return {
    start() {
      if (!animationFrameId) {
        animationFrameId = requestAnimationFrame(loop);
      }
    },

    stop() {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    },
  };
}
```

### Renderer.draw() Signature

```typescript
// src/shared/rendering/renderer.ts
export class Renderer {
  constructor(canvas: HTMLCanvasElement) {
    this.gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
  }

  setShaderFromPipeline(steps: StepRuntimeModel[]): void {
    // Compile shader and bind to program
  }

  draw(
    lineDirection: [number, number, number],
    material: MaterialSettings,
    luts: LutModel[],
  ): void {
    // 1. Bind textures (applyLutTextures)
    // 2. Set uniforms (material color, light direction, etc.)
    // 3. Bind geometry (vertex positions, normals, UVs)
    // 4. Execute draw call (gl.drawArrays)
    // 5. (Optional) readPixels for step preview export
  }
}
```

---

## 4. Step Preview Rendering

### Architecture: GPU + CPU Fallback

```typescript
// src/features/step/step-preview-system.ts
export interface StepPreviewSystemOptions {
  container: HTMLElement;
  getSteps: () => StepModel[];
  getStepAtIndex: (index: number) => StepModel | null;
}

export function createStepPreviewSystem(
  options: StepPreviewSystemOptions,
): StepPreviewController {
  let renderer: StepPreviewRenderer | null;

  try {
    // Try GPU rendering
    renderer = new StepPreviewRenderer(canvas);
  } catch (e) {
    // Fallback to CPU
    renderer = null;
  }

  return {
    renderStepPreview(stepIndex: number): ImageData {
      const step = options.getStepAtIndex(stepIndex);
      if (!step) throw new Error(`Step ${stepIndex} not found`);

      if (renderer) {
        // ✅ GPU
        return renderer.render(step);
      } else {
        // ✅ CPU
        return cpuRenderStepPreview([step], 256, 256);
      }
    },
  };
}
```

### GPU Implementation

```typescript
// src/features/step/step-preview-renderer.ts
export class StepPreviewRenderer {
  private canvas: HTMLCanvasElement;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl')!;
    if (!this.gl) throw new Error('WebGL not supported');
  }

  render(step: StepRuntimeModel): ImageData {
    // 1. Compile per-step shader
    const shader = buildStepShader(step);
    this.program = compileShader(shader);

    // 2. Bind LUT texture
    applyLutTextures({
      gl: this.gl,
      program: this.program,
      luts: [step.lut],
      maxTextureUnits: 8,
    });

    // 3. Draw sphere geometry
    const sphere = createSphereGeometry(64);
    this.gl.bufferData(gl.ARRAY_BUFFER, sphere.positions);
    this.gl.drawArrays(gl.TRIANGLES, 0, sphere.indices.length);

    // 4. Read pixels
    const pixels = new Uint8ClampedArray(256 * 256 * 4);
    this.gl.readPixels(
      0,
      0,
      256,
      256,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      pixels,
    );

    return new ImageData(pixels, 256, 256);
  }
}
```

### CPU Implementation

```typescript
// src/features/step/step-preview-cpu-render.ts
export function cpuRenderStepPreview(
  steps: StepRuntimeModel[],
  width: number,
  height: number,
): ImageData {
  const pixels = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Map pixel to sphere surface
      const spherePos = pixelToSpherePosition(x, y, width, height);

      // Evaluate parameters at this position
      const context: StepParamContext = {
        meshPosition: spherePos,
        normal: calculateNormal(spherePos),
        uv: calculateSphereUV(spherePos),
      };

      // Compose color through steps
      const color = composeColorFromSteps(steps, [1, 1, 1], context);

      // Write to pixel buffer
      const idx = (y * width + x) * 4;
      pixels[idx] = Math.round(color[0] * 255);
      pixels[idx + 1] = Math.round(color[1] * 255);
      pixels[idx + 2] = Math.round(color[2] * 255);
      pixels[idx + 3] = 255;
    }
  }

  return new ImageData(pixels, width, height);
}
```

---

## 5. Interaction System Details

### Socket Parameter Connection DnD

#### DnD State Types

```typescript
// src/features/pipeline/pipeline-view.ts
export type SocketDragState =
  | {
      mode: 'param';
      param: ParamName;  // 'x', 'y', 'scale', etc.
      paramLabel: string;
    }
  | {
      mode: 'step';
      stepId: number;
      axis: SocketAxis;  // 'x' | 'y'
      stageIndex: number;  // Step index in chain
    };

export type SocketDropTarget =
  | { kind: 'param'; param: ParamName }
  | { kind: 'step'; stepId: number; axis: SocketAxis }
  | null;  // Invalid drop target

export type SocketDropPlacement =
  | {
      kind: 'param';
      param: ParamName;
      fromParam:? ParamName;  // Disconnect previous
    }
  | null;
```

#### Drop Target Resolution

```typescript
// src/shared/interactions/socket-dnd.ts
export function resolveSocketDropTarget(
  dragState: SocketDragState,
  pointX: number,
  pointY: number,
): SocketDropTarget {
  // Find DOM element at (x, y)
  const element = document.elementFromPoint(pointX, pointY) as HTMLElement;

  // Try to match socket element
  const paramSocket = element.closest('[data-socket-type="param"]');
  if (paramSocket) {
    const param = paramSocket.getAttribute('data-param-name') as ParamName;
    if (isValidParamName(param)) {
      return { kind: 'param', param };  // ✅ Valid drop
    }
  }

  const stepSocket = element.closest('[data-socket-type="step"]');
  if (stepSocket) {
    const stepId = Number(stepSocket.getAttribute('data-step-id'));
    const axis = stepSocket.getAttribute('data-axis') as SocketAxis;
    if (typeof stepId === 'number' && (axis === 'x' || axis === 'y')) {
      return { kind: 'step', stepId, axis };  // ✅ Valid drop
    }
  }

  return null;  // ❌ Invalid drop target
}
```

#### Validation Before Commit

```typescript
// src/shared/interactions/socket-validation.ts
export function validateSocketConnection(
  dragState: SocketDragState,
  dropTarget: SocketDropTarget,
): boolean {
  // ✅ Cannot drop param to param
  if (dragState.mode === 'param' && dropTarget?.kind === 'param') {
    return false;
  }

  // ✅ Cannot drop step socket to itself
  if (
    dragState.mode === 'step' &&
    dropTarget?.kind === 'step' &&
    dragState.stepId === dropTarget.stepId &&
    dragState.axis === dropTarget.axis
  ) {
    return false;
  }

  return true;
}
```

### Drop Indicators (Visual Feedback)

```typescript
// src/features/pipeline/pipeline-drop-indicators.ts
export interface ReorderIndicatorBinding<TId> {
  container: HTMLElement;
  items: Array<{ element: HTMLElement; id: TId }>;
  indicatorElement: HTMLElement;
  indicatorClass: string;  // CSS class for positioned indicator
}

export function updateReorderDropIndicators<TId>(
  binding: ReorderIndicatorBinding<TId>,
  state: ReorderIndicatorState<TId> | null,
): void {
  if (!state) {
    // Clear indicator
    binding.indicatorElement.classList.remove(binding.indicatorClass);
    return;
  }

  // Find target item position
  const targetItem = binding.items.find((item) => item.id === state.overItemId);
  if (!targetItem) return;

  const rect = targetItem.element.getBoundingClientRect();
  const containerRect = binding.container.getBoundingClientRect();

  // Position indicator (before or after target item)
  const top = state.dropAfter ? rect.bottom - containerRect.top : rect.top - containerRect.top;

  binding.indicatorElement.style.top = `${top}px`;
  binding.indicatorElement.classList.add(binding.indicatorClass);
}
```

---

## 6. Known Edge Cases & Workarounds

### A. Torus Winding Order

**Issue**: Torus geometry has reversed triangle winding on inner surface  
**Fix**: [geometry.ts](../../src/shared/utils/geometry.ts) ensures consistent winding  
**Impact**: Backface culling works correctly

```typescript
// Ensure all triangles have CCW winding when viewed from outside
for (let i = 0; i < indices.length; i += 3) {
  const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]];
  // Check if winding is correct, reverse if needed
  // ...
}
```

### B. Light Guide Occlusion (Two-Pass Blending)

**Issue**: Light direction guide can be occluded by 3D preview  
**Fix**: Two-pass rendering with blend state

```typescript
// src/shared/rendering/renderer.ts
draw(lineDirection, material, luts) {
  // Pass 1: Draw main geometry with LUT shaders
  this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
  // ... draw preview geometry

  // Pass 2: Draw light guide on top (always visible)
  this.gl.depthFunc(this.gl.ALWAYS);
  this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
  // ... draw guide lines & axes
}
```

### C. Sphere Culling Artifacts

**Issue**: Small sphere count → visible diagonal seams  
**Fix**: Increase segment/ring count (geometry.ts defaults to 64+)

```typescript
export function createSphereGeometry(segments = 64): Geometry {
  // segments=32 → visible seams at angles
  // segments=64 → smooth appearance
  // segments=128 → very smooth (performance cost)
}
```

### D. CPU Texture Sampling Edge Clamping

**Issue**: CPU interpolation at edges differs from WebGL CLAMP_TO_EDGE  
**Fix**: Explicit clamp before fetch

```typescript
function sampleLutColorLinear(lut, u, v) {
  const uPixel = Math.max(0.5, Math.min(lut.width - 0.5, u * lut.width - 0.5));
  const vPixel = Math.max(0.5, Math.min(lut.height - 0.5, v * lut.height - 0.5));
  // ... bilinear sample
}
```

---

## Summary: WebGL & Interaction Checklist

- [ ] Shader generation: `buildShaderFromPipeline()` tested with multi-step chains
- [ ] LUT sampling: CPU uses `u * w - 0.5` (not `u * (w - 1)`)
- [ ] Texture units: Check `maxTextureUnits` before binding
- [ ] Drop indicators: Use `data-*` attributes + direct comparison (not CSS selector)
- [ ] Event delegation: Single listener on parent, `elementFromPoint()` for target
- [ ] GPU ↔ CPU fallback: Same `composeColorFromSteps()` logic
- [ ] Geometry: Torus winding + sphere segment count adequate
- [ ] Light guide: Two-pass rendering if z-fighting occurs

