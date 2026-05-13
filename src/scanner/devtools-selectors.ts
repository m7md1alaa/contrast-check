export const BUILTIN_DEVTOOL_SELECTORS = [
  // TanStack Router / Query
  '[data-tanstack-router-devtools]',
  '[data-tanstack-query-devtools]',
  '[data-react-query-devtools]',
  '.tsqd-parent-container',
  '.tsqd-trigger',

  // Next.js
  '#__nextjs-dev-tools',
  '[data-nextjs-dev-tools]',
  '.nextjs-toast',
  '[data-nextjs-toast]',
  '.nextjs-error-overlay',
  '#__nextjs_error_dialog__',
  '[data-nextjs-error-dialog]',

  // Astro
  'astro-dev-toolbar',

  // Vite
  'vite-error-overlay',

  // Nuxt
  '.__nuxt-devtools-container__',
  '#nuxt-devtools',

  // Vue
  '.__vue-devtools__',
  '#vue-devtools-container',

  // Redux
  '.redux-devtools-dock',
  '.redux-devtools',

  // Gatsby
  '[data-gatsby-devtools]',

  // Angular
  '[data-ng-devtools]',

  // Svelte
  '.svelte-devtools',

  // Webpack dev server
  'webpack-dev-server-client-overlay',
];
