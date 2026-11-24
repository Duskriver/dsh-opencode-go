/**
 * Models sub-page of the OpenCode Go console.
 *
 * The reusable card carries the source tabs, the listing diagnostics and the
 * capacity editor; the page only closes it with the catalog note, because the
 * shell owns the header, the tabs and the save bar.
 */
import { useEffect } from 'react'
import { ModelsSettings } from '../Section.tsx'
import type { PageViewProps } from './types.ts'
import css from './SettingsPages.module.css'

/** Models tab: the reusable model settings card plus the catalog note. */
export function ModelsPage({ state, actions, locale }: PageViewProps) {
  useEffect(() => {
    if (state.status === 'ready' && state.models.status === 'idle') actions.loadModels()
  }, [state.status, state.models.status, actions.loadModels])
  return <div className={css.page}>
    <ModelsSettings state={state} t={actions.t} locale={locale} disabled={!state.writable}
      onEdit={actions.editModelLimits} setModelEnabled={actions.setModelEnabled} loadModels={actions.loadModels}
      onEnableFree={() => { actions.edit('freeEnabled', 'true') }}
      surface="page" />
    <p className={css.footnote}>{actions.t('modelsPageHint')}</p>
  </div>
}
