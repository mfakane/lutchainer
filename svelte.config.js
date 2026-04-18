export default {
  /** @type {import('svelte/compiler').CompileOptions} */
  compilerOptions: {
    customElement: true,
    compatibility: {
      componentApi: 4,
    },
    css: 'injected',
    generate: 'client',
  },
};
