/**
 * Appearance sub-page of the OpenCode Go console.
 *
 * Two cards: the theme and quota-display controls, then the advanced connection
 * and timeout fields. The staged draft and the save/discard bar belong to the
 * shell, so this page never renders its own actions.
 */
import { AdvancedSettings, AppearanceSettings } from '../Section.tsx'
import type { PageViewProps } from './types.ts'
import css from './SettingsPages.module.css'

/** Appearance tab: the reusable appearance and advanced cards. */
export function AppearancePage({ state, actions }: PageViewProps) {
  const t = actions.t
  const disabled = !state.writable
  return <div className={css.page}>
    <AppearanceSettings state={state} t={t} disabled={disabled} saving={state.saving}
      onEdit={actions.edit} resetField={actions.resetField} surface="page" />
    <AdvancedSettings state={state} t={t} disabled={disabled} saving={state.saving} invalidLabel={t('invalidValue')}
      edit={actions.edit} resetField={actions.resetField} surface="page" />
  </div>
}
