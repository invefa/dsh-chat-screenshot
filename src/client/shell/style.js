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
.cs-set {
  display: flex;
  flex-direction: column;
  padding: 4px 0 8px;
  font-size: 13px;
  color: var(--dsw-alias-label-primary);
}
.cs-set-intro {
  margin: 0 0 10px;
  font-size: 12px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary);
}
.cs-set-group {
  margin: 16px 0 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--dsw-alias-label-secondary);
}
.cs-set-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
}
.cs-set-row-stack {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}
.cs-set-row-check {
  cursor: pointer;
}
.cs-set-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1 1 auto;
  min-width: 0;
}
.cs-set-label {
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-primary);
}
.cs-set-desc {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-secondary);
}
.cs-set-box {
  flex: none;
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: var(--dsw-alias-brand-primary);
}
.cs-set-input,
.cs-set-select {
  box-sizing: border-box;
  width: 100%;
  max-width: 320px;
  height: 30px;
  padding: 0 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
}
.cs-set-select {
  max-width: 160px;
}
.cs-set-input:focus-visible,
.cs-set-select:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
}
.cs-set-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.cs-set-reset {
  flex: none;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font-size: 12px;
  cursor: pointer;
}
.cs-set-reset:hover {
  background: var(--dsw-alias-bg-layer-2);
}
.cs-pick-hint {
  margin: 0 0 12px;
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
  line-height: 1.5;
}
.cs-pick-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 46vh;
  padding-right: 4px;
  overflow-y: auto;
}
.cs-set-picker {
  flex: none;
  min-width: 96px;
}
.cs-prev-wrap {
  margin: 14px 0 10px;
}
.cs-prev {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 420px;
  overflow: auto;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
  line-height: 1.6;
}
.cs-prev.align-center {
  text-align: center;
}
.cs-prev-piece,
.cs-prev-insert {
  position: relative;
  border-radius: 8px;
  cursor: pointer;
}
.cs-prev-piece:hover,
.cs-prev-insert:hover {
  outline: 1px dashed var(--dsw-alias-border-l4);
  outline-offset: 2px;
}
.cs-prev-piece:focus-visible,
.cs-prev-insert:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
}
.cs-prev-piece.is-off,
.cs-prev-insert.is-empty {
  outline: 1px dashed var(--dsw-alias-border-l3);
  outline-offset: 2px;
  opacity: 0.75;
}
.cs-prev-off {
  display: inline-block;
  padding: 2px 8px;
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
.cs-prev-rail {
  align-self: flex-end;
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  letter-spacing: 0.04em;
}
.cs-prev-turn {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cs-prev-bubble {
  align-self: flex-end;
  max-width: 82%;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--dsw-alias-bg-layer-2);
}
.cs-prev-files,
.cs-prev-think,
.cs-prev-clock {
  color: var(--dsw-alias-label-secondary);
  font-size: 12px;
}
.cs-prev-think {
  padding: 6px 10px;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
}
.cs-prev-answer {
  max-width: 88%;
}
.cs-prev-chip {
  display: inline-block;
  padding: 3px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 999px;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
}
.cs-prev-insert {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 6px 0;
}
.cs-prev-title {
  font-size: 17px;
  font-weight: 600;
  line-height: 1.35;
}
.cs-prev-subtitle,
.cs-prev-footer {
  color: var(--dsw-alias-label-secondary);
  font-size: 13px;
}
.cs-prev-meta {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}
.cs-prev-rule {
  border-top: 1px solid var(--dsw-alias-border-l1);
}
.cs-prev-hint {
  margin: 0 0 8px;
}
.cs-prev-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cs-prev-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cs-prev-input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 8px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
  font-size: 13px;
}
.cs-prev-input:focus-visible {
  outline: 2px solid var(--dsw-alias-brand-primary);
  outline-offset: 1px;
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
