/** Sidebar row icon and page brand mark for OpenCode Go. */
import type { CSSProperties, ReactElement } from 'react'

/** Monochrome wave mark inside the colored page logo. */
export function GoMark(props: { size?: number; className?: string }): ReactElement {
  const size = props.size ?? 16
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      className={props.className}
      style={{ display: 'block' }}
    >
      <path
        d="M1.7 6.05c1.6 0 2.35-.95 3.75-.95 1.4 0 2.05.7 3.45.7 1.2 0 1.9-.5 3.15-.85"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M1.7 9.55c1.6 0 2.35-.95 3.75-.95 1.4 0 2.05.7 3.45.7 1.2 0 1.9-.5 3.15-.85"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="12.9" cy="12" r="1.15" fill="currentColor" />
    </svg>
  )
}

/** Colored square mark used by the page header and the About page. */
export function GoLogo(props: { size?: number; className?: string }): ReactElement {
  const size = props.size ?? 32
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: Math.round(size * 0.28),
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 'none',
    color: '#ffffff',
    background: 'linear-gradient(135deg, rgb(77 107 254), rgb(122 170 255))',
    boxShadow: '0 2px 8px rgba(30, 60, 160, 0.28)',
  }
  return (
    <span className={props.className} style={style} aria-hidden="true">
      <GoMark size={Math.round(size * 0.56)} />
    </span>
  )
}

/**
 * Sidebar row occupant: the host supplies the square edge and the active flag;
 * the icon inherits currentColor so the host's selected colour applies.
 * @param owner - slot owner props.
 * @returns the monochrome mark.
 */
export function GoRowIcon(owner: { size?: number; active?: boolean }): ReactElement {
  const size = owner.size ?? 16
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      aria-hidden="true"
      style={{ display: 'block' }}
    >
      <path
        d="M12.15 4.25C6.45 3.45 2.5 6.8 2.5 11.85c0 4.92 3.3 7.95 8.02 7.95 1.17 0 2.3-.15 3.13-.55M10.52 14.25v5.55"
        stroke="currentColor"
        strokeWidth="2.05"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10.65" cy="12.3" r="3.75" fill="currentColor" />
      <circle cx="17.85" cy="12.05" r="3.73" stroke="currentColor" strokeWidth="1.95" />
    </svg>
  )
}
