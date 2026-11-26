/**
 * The plugin's stylesheet: a button that reads as part of the composer row, a spinner, and a toast.
 *
 * Colours come from the host's `--dsw-alias-*` tokens only, so the control follows the theme and
 * both light and dark pages without a second palette. The CSS inside the template keeps its
 * semicolons: the sources are written without trailing semicolons in JavaScript, which a mechanical
 * pass must never apply to this string.
 */

export const STYLES = String.raw`
.cs-root { position: relative; display: flex; align-items: center; }
.cs-btn {
  box-sizing: border-box;
  width: 28px;
  height: 28px;
  flex: none;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 999px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  cursor: pointer;
  padding: 0;
}
.cs-btn:hover:not(:disabled) {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}
.cs-btn:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.cs-btn:disabled { cursor: progress; color: var(--dsw-alias-state-idle-primary); }
.cs-spinner {
  width: 13px;
  height: 13px;
  border-radius: 50%;
  border: 1.6px solid var(--dsw-alias-border-l2);
  border-top-color: var(--dsw-alias-brand-primary);
  animation: cs-spin .7s linear infinite;
}
@keyframes cs-spin { to { transform: rotate(360deg); } }
.cs-toast {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: 320px;
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-overlay);
  border: 1px solid var(--dsw-alias-border-l1);
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  line-height: 18px;
  white-space: normal;
  box-shadow: 0 6px 20px rgba(0, 0, 0, .18);
  z-index: 30;
  pointer-events: none;
}
`

/**
 * Append the stylesheet and hand back its removal.
 * @returns disposer that takes the style element out of the document again.
 */
export function installStyle() {
  const style = document.createElement('style')
  style.dataset.plugin = 'dsh-chat-screenshot'
  style.textContent = STYLES
  document.head.appendChild(style)
  return () => style.remove()
}
