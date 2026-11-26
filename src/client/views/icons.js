/**
 * The two glyphs an entry shows: a camera when it waits, a check while it confirms.
 */

import { h } from '../shell/runtime.js'
export function CameraIcon() {
  return h(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: 15,
      height: 15,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
      focusable: false,
    },
    h('path', {
      d:
        'M4 8.5A2.5 2.5 0 0 1 6.5 6h1.2a1 1 0 0 0 .83-.45l.94-1.4A1 1 0 0 1 10.3 3.7h3.4a1 1 0 0 1 ' +
        '.83.45l.94 1.4A1 1 0 0 0 16.3 6h1.2A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 ' +
        '0 1 4 17.5z',
    }),
    h('circle', { cx: 12, cy: 13, r: 3.4 }),
  )
}

export function CheckIcon() {
  return h(
    'svg',
    {
      viewBox: '0 0 24 24',
      width: 15,
      height: 15,
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      'aria-hidden': true,
      focusable: false,
    },
    h('path', { d: 'M4.5 12.8l4.9 4.8L19.5 6.6' }),
  )
}
