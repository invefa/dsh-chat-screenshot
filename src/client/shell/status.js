/**
 * The busy/status state both entries share, and the single delivery path: clipboard first, a
 * download when the clipboard refuses.
 */

import { useCallback, useEffect, useRef, useState } from '../shell/runtime.js'
import { useTranslate } from './i18n.js'
import { copyPng } from '../output/clipboard.js'
import { downloadPng } from '../output/download.js'
/** How long a status message stays on screen before it clears itself. */
const STATUS_HOLD_MS = 4200

/** How long the success check stays over the icon, matching the host's own copy feedback. */
const DONE_HOLD_MS = 1200

/**
 * @returns the translate function, the busy flag, the current status, the done flag, the anchor
 *   ref the entry attaches, and the runner that drives one capture.
 */
export function useCaptureStatus() {
  const t = useTranslate()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const [done, setDone] = useState(false)
  const anchorRef = useRef(null)
  const timerRef = useRef(null)
  const doneTimerRef = useRef(null)
  const aliveRef = useRef(true)

  useEffect(
    () => () => {
      aliveRef.current = false
      if (timerRef.current !== null) clearTimeout(timerRef.current)
      if (doneTimerRef.current !== null) clearTimeout(doneTimerRef.current)
    },
    [],
  )

  /** Show one message; with `hold` it stays until the next announce replaces it. */
  const announce = useCallback((next, hold) => {
    if (!aliveRef.current) return
    setStatus(next)
    if (timerRef.current !== null) clearTimeout(timerRef.current)
    if (hold !== true) timerRef.current = setTimeout(() => setStatus(null), STATUS_HOLD_MS)
  }, [])

  /** Flash a success check over the entry icon, the way the host marks a copy. */
  const markDone = useCallback(() => {
    if (!aliveRef.current) return
    setDone(true)
    if (doneTimerRef.current !== null) clearTimeout(doneTimerRef.current)
    doneTimerRef.current = setTimeout(() => {
      doneTimerRef.current = null
      if (aliveRef.current) setDone(false)
    }, DONE_HOLD_MS)
  }, [])

  const run = useCallback(
    (produce) => {
      const anchor = anchorRef.current
      if (anchor === null) return
      setBusy(true)
      Promise.resolve()
        .then(() => produce(anchor, announce))
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error)
          announce(
            message === 'empty'
              ? t('state.empty')
              : message === 'turn not found'
                ? t('state.turnMissing')
                : t('state.failed', { message }),
          )
        })
        .finally(() => {
          if (aliveRef.current) setBusy(false)
        })
    },
    [announce, t],
  )

  return { t, busy, status, done, markDone, anchorRef, announce, run }
}

/**
 * Copy the picture to the clipboard, falling back to a download.
 *
 * @param shot - the rendered picture plus its pixel size.
 * @param options.announce - the entry's status setter.
 * @param options.t - the active translate function.
 * @param options.sessionId - names the downloaded file.
 * @param options.success - builds the message for a successful copy, because only the entry knows
 *   whether it captured the whole conversation or one turn.
 * @param options.partial - whether the picture covers the loaded turns only.
 * @returns whether the clipboard write succeeded.
 */
export async function deliver(shot, { announce, t, sessionId, success, partial = false }) {
  const copied = await copyPng(shot.blob)
  if (copied) {
    announce(partial ? t('state.partialCopy') : success(shot))
  } else {
    downloadPng(shot.blob, sessionId)
    announce(partial ? t('state.downloadedPartial') : t('state.downloaded'))
  }
  if (shot.scale < 0.999) {
    setTimeout(
      () => announce(t('state.scaled', { scale: shot.scale.toFixed(2) })),
      STATUS_HOLD_MS + 100,
    )
  }
  return copied
}
