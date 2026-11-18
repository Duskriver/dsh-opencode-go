/**
 * Models sub-page of the OpenCode Go console.
 *
 * The reusable card carries the source tabs, the listing diagnostics and the
 * capacity editor; the page only closes it with the catalog note, because the
 * shell owns the header, the tabs and the save bar.
 */
import { ModelsSettings } from '../Section.tsx'
import type { PageViewProps } from './types.ts'
import css from './SettingsPages.module.css'

/** Models tab: the reusable model settings card plus the catalog note. */
export function ModelsPage({ state, actions, locale }: PageViewProps) {
  return <div className={css.page}>
    <ModelsSettings state={state} t={actions.t} locale={locale} disabled={!state.writable}
      onEdit={actions.editModelLimits} setModelEnabled={actions.setModelEnabled} loadModels={actions.loadModels}
      surface="page" />
    <p className={css.footnote}>{actions.t('modelsPageHint')}</p>
  </div>
}
