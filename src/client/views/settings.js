/**
 * The settings panel: what the picture keeps, what it adds, and how it is laid out.
 *
 * One row per decision, the way the host's own settings sections read: a label, a sentence saying what
 * the switch does, and the control on the right. Every value is written through `writeOptions`, so a
 * change applies to the next capture and survives a reload without a host round-trip.
 */

import { h, useState } from '../shell/runtime.js'
import { useTranslate } from '../shell/i18n.js'
import { resetOptions, useOptions, writeOptions } from '../shell/options.js'
import { EDGE_CHOICES, SCALE_CHOICES } from '../shell/const.js'

/** One switch: the label and description on the left, the box on the right. */
function SwitchRow({ title, description, checked, onChange }) {
  return h(
    'label',
    { className: 'cs-set-row cs-set-row-check' },
    h(
      'span',
      { className: 'cs-set-text' },
      h('span', { className: 'cs-set-label' }, title),
      h('span', { className: 'cs-set-desc' }, description),
    ),
    h('input', {
      className: 'cs-set-box',
      type: 'checkbox',
      checked,
      onChange: (event) => onChange(event.target.checked),
    }),
  )
}

/**
 * One free-text block. The field is uncontrolled and reseeded by `seed`, so typing is never fought by
 * the whitespace trimming the stored value goes through, while a reset still empties it.
 */
function TextRow({ title, description, value, placeholder, onChange, seed }) {
  return h(
    'div',
    { className: 'cs-set-row cs-set-row-stack' },
    h(
      'span',
      { className: 'cs-set-text' },
      h('span', { className: 'cs-set-label' }, title),
      h('span', { className: 'cs-set-desc' }, description),
    ),
    h('input', {
      key: `field-${seed}`,
      className: 'cs-set-input',
      type: 'text',
      defaultValue: value,
      placeholder,
      onChange: (event) => onChange(event.target.value),
    }),
  )
}

/** One choice out of a short list. */
function SelectRow({ title, description, value, options, onChange }) {
  return h(
    'label',
    { className: 'cs-set-row' },
    h(
      'span',
      { className: 'cs-set-text' },
      h('span', { className: 'cs-set-label' }, title),
      h('span', { className: 'cs-set-desc' }, description),
    ),
    h(
      'select',
      {
        className: 'cs-set-select',
        value,
        onChange: (event) => onChange(event.target.value),
      },
      options.map(([optionValue, optionLabel]) =>
        h('option', { key: optionValue, value: optionValue }, optionLabel),
      ),
    ),
  )
}

/** The section body mounted at `settings.section`. */
export function SettingsSection() {
  const t = useTranslate()
  const options = useOptions()
  const [seed, setSeed] = useState(0)

  const edgeLabels = [
    [String(EDGE_CHOICES[0]), t('settings.edge.tight')],
    [String(EDGE_CHOICES[1]), t('settings.edge.normal')],
    [String(EDGE_CHOICES[2]), t('settings.edge.loose')],
  ]
  const scaleLabels = [
    [SCALE_CHOICES[0], t('settings.scale.auto')],
    [SCALE_CHOICES[1], t('settings.scale.x1')],
    [SCALE_CHOICES[2], t('settings.scale.x2')],
    [SCALE_CHOICES[3], t('settings.scale.x3')],
  ]

  return h(
    'div',
    { className: 'cs-set' },
    h('p', { className: 'cs-set-intro' }, t('settings.intro')),

    h('div', { className: 'cs-set-group' }, t('settings.group.hide')),
    h(SwitchRow, {
      title: t('settings.hide.clock'),
      description: t('settings.hide.clockHint'),
      checked: options.hideClock,
      onChange: (value) => writeOptions({ hideClock: value }),
    }),
    h(SwitchRow, {
      title: t('settings.hide.process'),
      description: t('settings.hide.processHint'),
      checked: options.hideProcess,
      onChange: (value) => writeOptions({ hideProcess: value }),
    }),
    h(SwitchRow, {
      title: t('settings.hide.attachments'),
      description: t('settings.hide.attachmentsHint'),
      checked: options.hideAttachments,
      onChange: (value) => writeOptions({ hideAttachments: value }),
    }),
    h(SwitchRow, {
      title: t('settings.hide.nav'),
      description: t('settings.hide.navHint'),
      checked: options.hideNav,
      onChange: (value) => writeOptions({ hideNav: value }),
    }),
    h(SwitchRow, {
      title: t('settings.hide.handles'),
      description: t('settings.hide.handlesHint'),
      checked: options.hideHandles,
      onChange: (value) => writeOptions({ hideHandles: value }),
    }),
    h(SwitchRow, {
      title: t('settings.hide.toBottom'),
      description: t('settings.hide.toBottomHint'),
      checked: options.hideToBottom,
      onChange: (value) => writeOptions({ hideToBottom: value }),
    }),

    h('div', { className: 'cs-set-group' }, t('settings.group.add')),
    h(TextRow, {
      title: t('settings.add.title'),
      description: t('settings.add.titleHint'),
      placeholder: t('settings.add.titlePlaceholder'),
      value: options.title,
      seed,
      onChange: (value) => writeOptions({ title: value }),
    }),
    h(TextRow, {
      title: t('settings.add.subtitle'),
      description: t('settings.add.subtitleHint'),
      placeholder: t('settings.add.titlePlaceholder'),
      value: options.subtitle,
      seed,
      onChange: (value) => writeOptions({ subtitle: value }),
    }),
    h(TextRow, {
      title: t('settings.add.footer'),
      description: t('settings.add.footerHint'),
      placeholder: t('settings.add.titlePlaceholder'),
      value: options.footer,
      seed,
      onChange: (value) => writeOptions({ footer: value }),
    }),
    h(SwitchRow, {
      title: t('settings.add.meta'),
      description: t('settings.add.metaHint'),
      checked: options.showMeta,
      onChange: (value) => writeOptions({ showMeta: value }),
    }),
    h(SwitchRow, {
      title: t('settings.add.divider'),
      description: t('settings.add.dividerHint'),
      checked: options.divider,
      onChange: (value) => writeOptions({ divider: value }),
    }),

    h('div', { className: 'cs-set-group' }, t('settings.group.layout')),
    h(SelectRow, {
      title: t('settings.layout.align'),
      description: t('settings.layout.alignHint'),
      value: options.align,
      options: [
        ['left', t('settings.align.left')],
        ['center', t('settings.align.center')],
      ],
      onChange: (value) => writeOptions({ align: value }),
    }),
    h(SelectRow, {
      title: t('settings.layout.edge'),
      description: t('settings.layout.edgeHint'),
      value: String(options.edge),
      options: edgeLabels,
      onChange: (value) => writeOptions({ edge: Number(value) }),
    }),
    h(SelectRow, {
      title: t('settings.layout.scale'),
      description: t('settings.layout.scaleHint'),
      value: options.scale,
      options: scaleLabels,
      onChange: (value) => writeOptions({ scale: value }),
    }),

    h(
      'div',
      { className: 'cs-set-foot' },
      h('span', { className: 'cs-set-desc' }, t('settings.resetHint')),
      h(
        'button',
        {
          type: 'button',
          className: 'cs-set-reset',
          onClick: () => {
            resetOptions()
            setSeed((current) => current + 1)
          },
        },
        t('settings.reset'),
      ),
    ),
  )
}
