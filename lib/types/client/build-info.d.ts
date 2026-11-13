/**
 * Build facts shown on the About page.
 *
 * The client bundle cannot import \`package.json\` (it would inline the entire
 * manifest), and the build script only stamps \`lib/build-info.json\` after the
 * bundle is written. This tiny constant is the client-side mirror; a test in
 * \`tests/sidebar-page.client.spec.tsx\` asserts it matches \`package.json\` so a
 * release bump cannot drift.
 */
export declare const CLIENT_BUILD_INFO: {
    readonly packageName: "dsh-opencode-go";
    readonly version: "0.4.3";
    readonly minHost: "0.2.1-rc.5";
    readonly build: "esbuild + lightningcss";
};
