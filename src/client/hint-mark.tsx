/**
 * The hint mark a label carries and the sentence behind it.
 *
 * The Host's own Tooltip opens the sentence on hover and on keyboard focus, while
 * the same sentence stays in the document so assistive technology reads it without
 * opening anything. A Host that ships no question glyph still gets a mark, and a
 * Host with no Tooltip keeps the sentence visible instead of hiding it.
 */

import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'
import { hostAtom } from './host-primitives.ts'
import css from './Section.module.css'

/** 0.1.7 names icons by stroke weight; older hosts name them by pixel size. */
const QuestionMark = hostAtom<typeof primitives.IconQuestionOutline14>(
  primitives, 'IconQuestionOutlineRegular', 'IconQuestionOutline14',
)
/** Absent only on a Host older than the plugin's floor; the hint then stays visible. */
const HintTooltip = primitives.Tooltip as typeof Tooltip | undefined

/** A focusable help trigger; fields also retain their {@link HintText} description. */
export function HintMark(props: { hint: string }) {
  const glyph = QuestionMark ? <QuestionMark /> : '?'
  if (!HintTooltip) return <span className={css.info} aria-hidden="true">{glyph}</span>
  return <HintTooltip label={props.hint} side="bottom" maxWidth={280}>
    <button type="button" className={css.info} aria-label={props.hint}>
      <span aria-hidden="true">{glyph}</span>
    </button>
  </HintTooltip>
}

/** The hint sentence, at the id a control points its `aria-describedby` at. */
export function HintText(props: { id: string; hint: string }) {
  return <p id={props.id} className={HintTooltip ? css.visuallyHidden : css.rowHint}>{props.hint}</p>
}
