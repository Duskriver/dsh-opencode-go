import { expect, it } from 'vitest'
import { hostAtom } from '../src/client/host-primitives.ts'

/**
 * DSH 0.1.6 and older name icons by pixel size (`IconQuestionOutline14`), 0.1.7 and
 * later by stroke weight (`IconQuestionOutlineRegular`), and 0.2 dropped the old
 * alias. A missing atom is not a cosmetic loss: React throws on an undefined element
 * type, the Host's error boundary catches it, and the settings surface then stays
 * blank until the Harness process restarts. The resolution order is pinned here, and
 * `tests/fixtures/client-compatibility.mjs` renders the opened advanced card against
 * every installed Host generation.
 */
it('prefers the stroke-weight name and keeps the pixel-size alias behind it', () => {
  const current = { IconQuestionOutlineRegular: 'stroke-weight' }
  const previous = { IconQuestionOutline14: 'pixel-size' }
  expect(hostAtom(current, 'IconQuestionOutlineRegular', 'IconQuestionOutline14')).toBe('stroke-weight')
  expect(hostAtom(previous, 'IconQuestionOutlineRegular', 'IconQuestionOutline14')).toBe('pixel-size')
  expect(hostAtom({ ...current, ...previous }, 'IconQuestionOutlineRegular', 'IconQuestionOutline14')).toBe('stroke-weight')
  // Neither name: the caller renders its own fallback instead of an undefined type.
  expect(hostAtom({}, 'IconQuestionOutlineRegular', 'IconQuestionOutline14')).toBeUndefined()
})
