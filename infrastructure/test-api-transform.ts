import swc from 'unplugin-swc';

// Match Nest's production decorator metadata rather than bypassing DTO validation.
export function apiTestTransform() {
  return swc.vite({
    // The plugin disables Vite's TS transform for this Node project, so it must
    // also strip types in imported shared packages and API-client unit tests.
    include: /\.ts$/,
    exclude: '**/node_modules/**',
    tsconfigFile: false,
    jsc: {
      target: 'es2022',
      parser: { syntax: 'typescript', decorators: true },
      transform: { legacyDecorator: true, decoratorMetadata: true },
    },
    module: { type: 'es6' },
  });
}
