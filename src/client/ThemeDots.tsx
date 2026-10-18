import type { en } from './locales.ts'
import { GO_THEMES, GO_THEME_LABELS, GO_THEME_TOKENS, setGoTheme, useGoTheme } from './theme.ts'
import css from './ThemeDots.module.css'

/**
 * Four palette dots shared by the pill popover and the dashboard header.
 * @param props.t - copy lookup.
 * @param props.compact - hide the text label (the popover has no room).
 */
export function ThemeDots({ t, compact = false }: {
  t: (key: keyof typeof en) => string
  compact?: boolean
}) {
  const active = useGoTheme()
  return <div className={css.row} role="group" aria-label={t('themeLabel')}>
    {compact ? null : <span className={css.label}>{t('themeLabel')}</span>}
    {GO_THEMES.map(id => {
      const { accent, accent2 } = GO_THEME_TOKENS[id].dark
      return <button
        key={id}
        type="button"
        className={css.dot}
        aria-pressed={active === id}
        aria-label={t(GO_THEME_LABELS[id])}
        title={t(GO_THEME_LABELS[id])}
        style={{ background: 'linear-gradient(135deg, ' + accent + ', ' + accent2 + ')' }}
        onClick={() => { setGoTheme(id) }}
      />
    })}
  </div>
}
