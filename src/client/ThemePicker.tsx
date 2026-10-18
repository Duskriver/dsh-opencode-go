import type { en } from './locales.ts'
import { GO_THEMES, GO_THEME_LABELS, GO_THEME_TOKENS, setGoTheme, useGoTheme, useHostScheme } from './theme.ts'
import css from './ThemePicker.module.css'

/**
 * The one place a style is chosen: four previews, each a miniature of the
 * surface it selects, on the Settings page. The picker lives here rather than in
 * the pill or the dashboard so a working session never changes its own look.
 * @param props.t - copy lookup.
 */
export function ThemePicker({ t }: { t: (key: keyof typeof en) => string }) {
  const active = useGoTheme()
  const scheme = useHostScheme()
  return <div className={css.group} role="group" aria-label={t('themeLabel')}>
    {GO_THEMES.map(id => {
      const tokens = GO_THEME_TOKENS[id][scheme]
      const name = t(GO_THEME_LABELS[id])
      return <button
        key={id}
        type="button"
        className={css.option}
        aria-pressed={active === id}
        data-theme={id}
        title={name}
        onClick={() => { setGoTheme(id) }}
      >
        {/* A four-line sketch of one panel: its surface, its accent and two text
            tones. Inline because each tile paints a different palette. */}
        <span
          className={css.swatch}
          aria-hidden="true"
          style={{ background: tokens.surface, borderColor: tokens.border }}
        >
          <span className={css.swatchRow}>
            <span className={css.swatchDot} style={{ background: tokens.accent }} />
            <span className={css.swatchBar} style={{ background: tokens.accent, opacity: .5, width: '18px' }} />
          </span>
          <span className={css.swatchBar} style={{ background: tokens.muted, opacity: .5 }} />
          <span className={css.swatchBar} style={{ background: tokens.muted, opacity: .28, width: '62%' }} />
        </span>
        <span className={css.name}>{name}</span>
      </button>
    })}
  </div>
}
