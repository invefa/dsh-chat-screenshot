/**
 * Clipboard write, with the two failure modes the browser has: no ClipboardItem at all, and a write
 * that stays pending forever because the document lost focus.
 */

import { CLIPBOARD_TIMEOUT } from '../shell/const.js'
export const canWriteClipboard =
  typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write !== undefined

/**
 * Write the PNG to the system clipboard.
 *
 * A browser whose document is not focused can leave `clipboard.write()` pending instead of
 * rejecting, so the write is raced against a timeout: the caller always gets an answer and can fall
 * back to a download.
 * @returns whether the clipboard accepted the image.
 */
export async function copyPng(blob, timeout = CLIPBOARD_TIMEOUT) {
  if (!canWriteClipboard) return false
  try {
    const write = navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return await Promise.race([
      write.then(
        () => true,
        () => false,
      ),
      new Promise((resolve) => setTimeout(() => resolve(false), timeout)),
    ])
  } catch {
    return false
  }
}
