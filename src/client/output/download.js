/**
 * The fallback output: a PNG download, named after the session and the moment it was taken.
 */

export function downloadPng(blob, sessionId) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const short = String(sessionId ?? 'session').slice(0, 8)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `dsh-conversation-${short}-${stamp}.png`
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}
