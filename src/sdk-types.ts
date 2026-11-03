/** Public SDK types bundled independently of the private runtime implementation. */
import type { Api as SdkApi, Model as SdkModel } from 'opencode-go-pi-ai'
import type { PriceMultiplier } from './pricing.ts'
import type { ModelSource } from './contracts.ts'

/** Public SDK types are bundled at build time, alongside the private implementation. */
export type {
  Api, Provider, ModelThinkingLevel, ThinkingLevelMap, ThinkingBudgets, ModelCost,
  AssistantMessage, AssistantMessageEvent, Usage, ToolCall,
  Context, ImageContent, Message, TextContent, Tool, SimpleStreamOptions, StreamFunction,
} from 'opencode-go-pi-ai'

/** User controls are independent of the SDK's internal level used to enable a switch. */
export type Model<TApi extends SdkApi> = SdkModel<TApi> & {
  source?: ModelSource
  reasoningControl?: 'toggle' | 'effort' | 'budget'
  reasoningBudget?: { min: number; max: number }
  reasoningBudgetPresets?: readonly number[]
  multipliers?: readonly PriceMultiplier[]
}
