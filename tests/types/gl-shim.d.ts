declare module 'gl' {
  const createGl: (width: number, height: number, options?: object) => WebGLRenderingContext | null;
  export default createGl;
}
