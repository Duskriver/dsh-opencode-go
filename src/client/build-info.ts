/**
 * Build facts shown on the About page.
 *
 * The client bundle cannot import \`package.json\` (it would inline the entire
 * manifest), and the build script only stamps \`lib/build-info.json\` after the
 * bundle is written. This tiny constant is the client-side mirror; a test in
 * \`tests/sidebar-page.client.spec.tsx\` asserts it matches \`package.json\` so a
 * release bump cannot drift.
 */
export const CLIENT_BUILD_INFO = {
  packageName: 'dsh-opencode-go',
  version: '0.5.0',
  minHost: '0.2.1-rc.5',
  build: 'esbuild + lightningcss',
} as const
