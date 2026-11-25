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
.cs-ed-root {
  /* Above the host's dialog layer (1000) so the surface covers a settings dialog it was opened from;
     below the tooltip and menu layers (1100) so the host's own popups still sit on top. */
  position: relative;
  z-index: 1050;
}
.cs-ed-wrap {
  position: fixed;
  inset: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  /* The overlay covers the conversation itself; a frameless window paints its title bar over the
     page, so nothing interactive may sit at the very top of the screen. */
  -webkit-app-region: no-drag;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-primary);
}
.cs-ed-canvas {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  background: var(--dsw-alias-bg-base);
}
.cs-ed-host {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}
.cs-ed-dock {
  display: flex;
  flex: none;
  flex-direction: column;
  min-height: 0;
  border-top: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, .08);
  transition: height .18s ease;
}
.cs-ed-dock.is-collapsed {
  height: auto;
}
.cs-ed-resize {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: center;
  height: 12px;
  cursor: ns-resize;
  touch-action: none;
}
.cs-ed-grip {
  width: 44px;
  height: 4px;
  border-radius: 999px;
  background: var(--dsw-alias-border-l2);
  transition: width .16s ease, background .16s ease;
}
.cs-ed-resize:hover .cs-ed-grip,
.cs-ed-dock.is-dragging .cs-ed-grip {
  width: 60px;
  background: var(--dsw-alias-brand-primary);
}
.cs-ed-dock-head {
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
  padding: 0 16px 8px;
}
.cs-ed-tabs {
  display: flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}
.cs-ed-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
  transition: background .14s ease, color .14s ease;
}
.cs-ed-tab:hover {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}
.cs-ed-tab.is-on {
  background: var(--dsw-alias-bg-layer-3);
  color: var(--dsw-alias-label-primary);
  font-weight: 600;
}
.cs-ed-tab-count {
  min-width: 16px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary);
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}
.cs-ed-head-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-left: auto;
}
.cs-ed-dock-body {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  animation: cs-dock-in .16s ease;
}
@keyframes cs-dock-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.cs-ed-split {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.cs-ed-split-main {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: auto;
  padding: 4px 16px 14px;
}
.cs-ed-split-side {
  display: flex;
  flex: 0 0 320px;
  min-height: 0;
  flex-direction: column;
  gap: 8px;
  overflow: auto;
  padding: 4px 16px 14px;
  border-left: 1px solid var(--dsw-alias-border-l1);
  font-size: 12px;
}
.cs-ed-split-side.is-narrow {
  flex: 0 0 260px;
}
.cs-ed-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cs-ed-panel-head {
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.cs-ed-empty-note {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 1.7;
}
.cs-ed-hintline {
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
}
.cs-ed-libwrap {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: auto;
}
.cs-ed-zones {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.cs-ed-zone {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cs-ed-zone-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.cs-ed-zone-name {
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  letter-spacing: .04em;
  text-transform: uppercase;
}
.cs-ed-zone-count {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
}
.cs-ed-zone-add {
  margin-left: auto;
  padding: 2px 8px;
  border: 1px dashed var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: border-color .14s ease, color .14s ease;
}
.cs-ed-zone-add:hover {
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-primary);
}
.cs-ed-zone-empty {
  padding: 10px 12px;
  border: 1px dashed var(--dsw-alias-border-l1);
  border-radius: 8px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 1.6;
}
.cs-ed-rows {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cs-ed-row-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
  transition: background .14s ease, border-color .14s ease;
}
.cs-ed-row-item:hover {
  background: var(--dsw-alias-bg-layer-3);
}
.cs-ed-row-item.is-on {
  border-color: var(--dsw-alias-brand-primary);
  background: var(--dsw-alias-bg-layer-3);
}
.cs-ed-row-kind {
  flex: none;
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
}
.cs-ed-row-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cs-ed-row-more {
  flex: none;
  padding: 2px 6px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.cs-ed-row-more:hover {
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
}
@media (prefers-reduced-motion: reduce) {
  .cs-ed-dock,
  .cs-ed-dock-body,
  .cs-ed-tab,
  .cs-ed-row-item,
  .cs-ed-zone-add,
  .cs-ed-grip {
    transition: none;
    animation: none;
  }
}
.cs-ed-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.cs-ed-lib {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}
.cs-ed-add {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 9px;
  border: 1px dashed var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: grab;
  text-align: left;
}
.cs-ed-add:hover {
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-primary);
}
.cs-ed-add-custom {
  display: flex;
  align-items: center;
  gap: 4px;
}
.cs-ed-add-custom .cs-ed-add {
  flex: 1;
  min-width: 0;
}
.cs-ed-x {
  flex: none;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 13px;
  line-height: 1;
  cursor: pointer;
}
.cs-ed-x:hover {
  background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-primary);
}
.cs-ed-token {
  padding: 1px 5px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 4px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  cursor: pointer;
}
.cs-ed-token:hover {
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-primary);
}
.cs-ed-area {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  padding: 5px 7px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: var(--dsw-alias-bg-base);
  color: inherit;
  font: inherit;
  line-height: 1.5;
  resize: vertical;
}
.cs-ed-area:focus-visible {
  border-color: var(--dsw-alias-brand-primary);
  outline: none;
}
.cs-ed-select {
  flex: none;
  max-width: 132px;
  padding: 4px 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: var(--dsw-alias-bg-base);
  color: inherit;
  font: inherit;
  font-size: 12px;
}
.cs-ed-file {
  display: none;
}
.cs-ed-drop {
  position: absolute;
  right: 0;
  left: 0;
  height: 2px;
  border-radius: 2px;
  background: var(--dsw-alias-brand-primary);
  pointer-events: none;
}
.cs-ed-side-empty {
  padding: 12px 0;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  line-height: 1.7;
}
.cs-ed-side-head {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.cs-ed-side-tag {
  flex: none;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  font-weight: 600;
}
.cs-ed-side-text {
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary);
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cs-ed-label {
  color: var(--dsw-alias-label-secondary);
  font-size: 11px;
  letter-spacing: 0.02em;
}
.cs-ed-mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  color: var(--dsw-alias-label-secondary);
  word-break: break-all;
}
.cs-ed-note {
  color: var(--dsw-alias-label-tertiary);
  font-size: 11px;
  line-height: 1.6;
}
.cs-ed-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  min-width: 0;
}
.cs-ed-field-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
  min-width: 0;
}
.cs-ed-field-row .cs-ed-input {
  flex: none;
}
.cs-ed-prop {
  flex: none;
  width: 104px;
  overflow: hidden;
  color: var(--dsw-alias-label-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cs-ed-input {
  flex: 1 1 96px;
  min-width: 0;
  box-sizing: border-box;
  padding: 4px 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: var(--dsw-alias-bg-base);
  color: inherit;
  font: inherit;
}
.cs-ed-input:focus-visible {
  border-color: var(--dsw-alias-brand-primary);
  outline: none;
}
.cs-ed-mini {
  flex: none;
  padding: 2px 6px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: transparent;
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  cursor: pointer;
}
.cs-ed-mini:hover {
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-primary);
}
.cs-ed-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.cs-ed-hidden {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-content: flex-start;
  align-items: center;
  gap: 6px 8px;
  max-height: 30%;
  overflow: auto;
  padding: 8px 20px 10px;
  border-top: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
}
.cs-ed-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 240px;
  padding: 3px 8px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 5px;
  background: var(--dsw-alias-bg-base);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.cs-ed-chip:hover {
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-primary);
}
.cs-ed-chip-part {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cs-ed-chip-count {
  flex: none;
  margin-left: 5px;
  color: var(--dsw-alias-label-tertiary);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px;
}
.cs-ed {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}
.cs-ed-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--cs-edge, 24px) 0;
}
.cs-ed-frame {
  position: relative;
  margin: 0 auto;
  overflow: hidden;
  box-shadow: 0 0 0 1px var(--dsw-alias-border-l2);
}
.cs-ed-stage {
  pointer-events: auto;
  user-select: none;
}
.cs-ed-stage [data-dsh-screenshot-piece] {
  cursor: pointer;
}
.cs-ed-hit {
  outline: 1px solid var(--dsw-alias-brand-primary) !important;
  outline-offset: -1px;
}
.cs-ed-sel {
  outline: 1px solid var(--dsw-alias-brand-primary) !important;
  outline-offset: -1px;
  background-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 10%, transparent);
}
.cs-ed-peek {
  outline: 1px dashed var(--dsw-alias-brand-primary) !important;
  outline-offset: -1px;
  background-color: color-mix(in srgb, var(--dsw-alias-brand-primary) 16%, transparent);
}
.cs-ed-field {
  outline: 1px dashed transparent;
  outline-offset: 2px;
  cursor: text;
  border-radius: 4px;
  user-select: text;
}
.cs-ed-field:hover {
  outline-color: var(--dsw-alias-border-l4);
}
.cs-ed-field:focus {
  outline: 1px solid var(--dsw-alias-brand-primary);
  outline-offset: 2px;
}
.cs-ed-stage [data-dsh-screenshot-block] {
  cursor: move;
  outline: 1px dashed transparent;
  outline-offset: 1px;
}
.cs-ed-stage [data-dsh-screenshot-block]:hover {
  outline-color: var(--dsw-alias-border-l4);
}
.cs-ed-stage [data-dsh-screenshot-block].cs-ed-sel {
  outline: 1px solid var(--dsw-alias-brand-primary) !important;
}
.cs-blk-zone {
  display: block;
  min-height: 0;
}
.cs-blk-empty {
  margin: 6px 0;
  padding: 10px 12px;
  border: 1px dashed var(--dsw-alias-border-l2);
  border-radius: 6px;
  color: var(--dsw-alias-label-tertiary);
  font-size: 12px;
  text-align: center;
}
.cs-blk-empty:hover {
  border-color: var(--dsw-alias-brand-primary);
  color: var(--dsw-alias-brand-primary);
}
.cs-ed-field[data-empty='true']::before {
  content: attr(data-cs-placeholder);
  opacity: 0.55;
  pointer-events: none;
}
.cs-ed-newcmp {
  margin-left: auto;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  font-size: 12px;
  padding: 3px 8px;
  cursor: pointer;
  transition: background-color .12s ease, border-color .12s ease;
}
.cs-ed-newcmp:hover {
  background: var(--dsw-alias-bg-layer-2);
  border-color: var(--dsw-alias-border-l3);
}
.cs-ed-cmp {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-1);
  animation: cs-dock-in .16s ease;
}
.cs-ed-cmp-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cs-ed-cmp-stage {
  min-height: 54px;
  padding: 10px;
  border-radius: 8px;
  border: 1px dashed var(--dsw-alias-border-l2);
  background: var(--dsw-alias-bg-base);
  overflow: auto;
}
.cs-ed-cmp-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.cs-ed-libwrap .cs-ed-split-side {
  flex: 0 0 360px;
  overflow: auto;
  padding-left: 14px;
}.cs-set-open {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-start;
  margin: 4px 0 18px;
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

