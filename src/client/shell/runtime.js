/**
 * The host modules the capture renders with.
 *
 * `require` is the parameter the bundle factory receives from the client module system; the table
 * it resolves against holds the platform singletons, so `react` here is the host's React and not a
 * second copy. A part imported directly by node (the offline checks) has no `require`, which is why
 * only the view parts may touch `h`.
 */

export const loaded = typeof require === 'function'

export const react = loaded ? require('react') : undefined

export const h = loaded ? react.createElement : undefined

export const Fragment = loaded ? react.Fragment : undefined

/** The React hook references the capture uses, kept in one place so node can import the parts. */
export function useCallback(fn, deps) {
  return react.useCallback(fn, deps)
}

export function useEffect(fn, deps) {
  return react.useEffect(fn, deps)
}

export function useRef(value) {
  return react.useRef(value)
}

export function useState(value) {
  return react.useState(value)
}
