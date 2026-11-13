/**
 * Host slot declarations this plugin adds to the client SlotMap.
 *
 * The declarations mirror the published DSH host contracts verbatim, so the
 * plugin can use \`main\` and \`sidebar.panellist\` without depending on the host
 * UI packages (which are not part of this package's devDependencies and whose
 * type declarations would drag in further unpublished modules).
 *
 * Contract sources (verified against the published packages):
 * - @deepseek-ai/dsh-client-ui-layout \`lib/types/client/index.d.ts\` — \`'main'\`
 *   is \`{ kind: 'keyed'; scope: 'root' }\`; the layout service exposes
 *   \`panelInfo\` and \`selectPanel(id | null)\` (\`lib/types/client/service.d.ts\`).
 * - @deepseek-ai/dsh-client-ui-sidebar \`lib/types/client/contract/slots.d.ts\`
 *   — \`'sidebar.panellist'\` is a root list whose owner props are
 *   \`{ size: number; active: boolean }\`; each registration's \`id\` addresses
 *   the matching \`main\` key.
 *
 * Both slots exist since DSH 0.2.1-alpha / 0.2.1-rc line, so the package keeps
 * its \`engines.dsh >= 0.2.1-rc.5\` baseline. If a future devDependency adds the
 * host UI packages as typed peers, delete this augmentation (the host
 * declarations would collide with it) and import their \`./client\` types.
 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface SlotMap {
        /** Central panel selected by the matching sidebar entry id. */
        'main': {
            kind: 'keyed';
            scope: 'root';
        };
        /** Global panel rows under the host's Plugins row. */
        'sidebar.panellist': {
            kind: 'list';
            scope: 'root';
            owner: {
                size: number;
                active: boolean;
            };
        };
        /**
         * The glyph shown beside one settings section in the settings dialog's
         * navigation. DSH 0.2.2 grew this seat; the row's section id addresses it.
         * Older hosts do not declare it, which is exactly what the capability probe
         * in `settings-nav-icon.tsx` watches for.
         */
        'settings.section.icon': {
            kind: 'list';
            scope: 'root';
            owner: {
                size?: number;
            };
        };
    }
}
/** Identity shared by the sidebar row and the \`main\` panel it opens. */
export declare const PAGE_PANEL_ID = "opencode-go";
/** Settings-section key: the nav row, the settings page and its icon all share it. */
export declare const SETTINGS_SECTION_ID = "opencode-go";
/** Host slot that supplies a settings-section nav glyph (DSH 0.2.2+). */
export declare const SETTINGS_SECTION_ICON_SLOT = "settings.section.icon";
/**
 * Directly below the plugin market (order 1) and above Scheduled tasks
 * (order 10): the console page sits with the other plugin destinations.
 */
export declare const PAGE_SIDEBAR_ORDER = 2;
/** Root-scoped navigation state the host exposes through \`ctx.layout\`. */
export interface GoPanelInfo {
    readonly activePanelId: string | null;
}
/** Host observable surface (snapshot + subscribe), as used by React consumers. */
export interface GoHostObservable<T> {
    getSnapshot(): T;
    subscribe(listener: () => void): () => void;
}
/** The subset of the host \`ctx.layout\` service this plugin uses. */
export interface GoLayoutService {
    readonly panelInfo: GoHostObservable<GoPanelInfo>;
    selectPanel(id: string | null): void;
}
