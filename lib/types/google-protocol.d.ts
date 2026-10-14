/** Google GenerateContent wire specifics pi-ai's adapter cannot express itself. */
import type { Api, Model } from './sdk-types.ts';
import type { ReasoningIntent } from './reasoning.ts';
/**
 * pi-ai maps a missing `reasoning` option to an explicitly disabled thinking
 * config (`thinkingBudget: 0` on IDs it does not recognize), which silently
 * discards reasoning on Default calls. Dropping the model's reasoning flag for
 * that one call makes the adapter emit no thinking config at all, leaving the
 * thinking level to the provider like the other protocols' Default. The flag
 * only gates that wire decision; response thinking parts still convert.
 * An explicit Off keeps the unpatched model, so disabling stays disabling.
 */
export declare function modelForReasoningIntent<T extends Api>(model: Model<T>, intent: ReasoningIntent): Model<T>;
/**
 * Google calls cannot carry diagnostics.fetch, so the gateway's structured
 * rejection body never reaches the classifier and pi-ai flattens key
 * rejections to AUTH, which account switching ignores. A 401 names the key:
 * promote it to the code other protocols classify from the captured body.
 * 403s stay AUTH — they carry consent and permission refusals, where trying
 * every account is noise.
 */
export declare function googleFailureCode(api: Api, code: string, message: string): string;
