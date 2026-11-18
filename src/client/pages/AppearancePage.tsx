/**
 * Appearance sub-page of the OpenCode Go console.
 *
 * Theme and quota-display controls live here; changes apply directly through
 * the shell's appearance actions.
 */
import { AppearanceSettings } from '../Section.tsx'
import type { PageViewProps } from './types.ts'
import css from './SettingsPages.module.css'

/** Appearance tab: the reusable theme and quota-display card. */
export function AppearancePage({ state, actions }: PageViewProps) {
  const t = actions.t
  const disabled = !state.writable
  return <div className={css.page}>
    <AppearanceSettings state={state} t={t} disabled={disabled} saving={state.saving}
      onEdit={actions.edit} resetField={actions.resetField} surface="page" />
  </div>
}
