/**
 * Advanced settings sub-page of the OpenCode Go console.
 *
 * Connection, cache, timeout, and image fields. The staged draft and the
 * save/discard bar belong to the shell, so this page never renders its own
 * actions.
 */
import { AdvancedSettings } from '../Section.tsx'
import type { PageViewProps } from './types.ts'
import css from './SettingsPages.module.css'

/** Advanced tab: the reusable advanced connection and timeout controls. */
export function AdvancedPage({ state, actions }: PageViewProps) {
  const t = actions.t
  const disabled = !state.writable
  return <div className={css.page}>
    <AdvancedSettings state={state} t={t} disabled={disabled} saving={state.saving} invalidLabel={t('invalidValue')}
      edit={actions.edit} resetField={actions.resetField} surface="page" />
  </div>
}
