/** Public SDK types are bundled at build time, alongside the private implementation. */
export type {
  Api, Provider, ModelThinkingLevel, ThinkingLevelMap, ThinkingBudgets, ModelCost,
  AssistantMessage, AssistantMessageEvent, Usage, ToolCall,
  Context, ImageContent, Message, TextContent, Tool,
} from 'opencode-go-pi-ai'

import type { Api as SdkApi, Model as SdkModel } from 'opencode-go-pi-ai'
import type { ThinkingBudgetRange } from './models-contract.ts'

/** User controls are independent of the SDK's internal level used to enable a switch. */
export type Model<TApi extends SdkApi> = SdkModel<TApi> & {
  reasoningControl?: 'toggle' | 'effort' | 'budget'
  reasoningBudget?: ThinkingBudgetRange
  reasoningBudgetPresets?: readonly number[]
}
