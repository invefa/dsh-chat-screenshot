/**
 * The dock: tools along the bottom edge of the surface.
 *
 * An inspector that takes width takes it away from the copy, and the copy is the thing being judged,
 * so the tools sit under the picture instead of beside it. The dock carries three tabs — what the
 * picture holds, what one element of it is, and the shelf new content comes from — and the actions
 * that apply to the whole surface. Its height belongs to the reader: the strip above it drags, a
 * double click folds it down to the tab row, and folding is animated so the copy grows back into the
 * space instead of jumping into it.
 *
 * The strip is also the reason there is no action bar floating near the top of the window: a frameless
 * window draws its own title bar and window buttons above the page, and controls placed under them are
 * half unclickable. Everything the reader presses lives at the bottom.
 */
import { h } from '../../shell/runtime.js'

/** One tab label with the number of things behind it, when that number is worth showing. */
function tabButton(tab, current, onTab) {
  return h(
    'button',
    {
      key: tab.id,
      type: 'button',
      role: 'tab',
      'aria-selected': tab.id === current ? 'true' : 'false',
      className: tab.id === current ? 'cs-ed-tab is-on' : 'cs-ed-tab',
      onClick: () => onTab(tab.id),
    },
    h('span', { className: 'cs-ed-tab-label' }, tab.label),
    tab.count > 0 ? h('span', { className: 'cs-ed-tab-count' }, String(tab.count)) : null,
  )
}

export function dockView(props) {
  const { t, Button, tabs, current, onTab, pick, onPick, onReset, onDone, collapsed, onToggle, body, height, dragging, onResizeStart } = props
  return h(
    'div',
    {
      className: `cs-ed-dock${collapsed ? ' is-collapsed' : ''}${dragging ? ' is-dragging' : ''}`,
      style: collapsed ? undefined : { height: `${height}px` },
    },
    h(
      'div',
      { className: 'cs-ed-resize', title: t('settings.editor.dock.resize'), onPointerDown: onResizeStart, onDoubleClick: onToggle },
      h('span', { className: 'cs-ed-grip' }),
    ),
    h(
      'div',
      { className: 'cs-ed-dock-head' },
      h('div', { className: 'cs-ed-tabs', role: 'tablist' }, ...tabs.map((tab) => tabButton(tab, current, onTab))),
      h(
        'div',
        { className: 'cs-ed-head-actions' },
        h(Button, { variant: pick ? 'primary' : 'ghost', size: 'sm', onClick: onPick }, t('settings.editor.pick')),
        h(Button, { variant: 'ghost', size: 'sm', onClick: onReset }, t('settings.reset')),
        h(Button, { variant: 'primary', size: 'sm', onClick: onDone }, t('settings.editor.done')),
      ),
    ),
    collapsed ? null : h('div', { className: 'cs-ed-dock-body', key: current }, body),
  )
}
