import type { Context } from '@deepseek-ai/cordis';
import type { SettingsScope } from './settings.ts';
import type { OpencodeGoSettings } from './section-controller.ts';
export declare function registerUsagePill(ctx: Context, settings: SettingsScope<OpencodeGoSettings>, selectAccount?: (ref: string) => Promise<boolean>): void;
