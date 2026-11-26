/**
 * One labelled menu of a few values, built from the host's own components: the row every choice in
 * the inspector is made of.
 *
 * The menu is a portal anchored to the button. Rendered in place it would be laid out inside the
 * row -- a flex child of a scrolling column, clipped at the column's edge and ordered after the
 * label -- instead of floating over the surface at the point it was opened from.
 */
import { h, useEscapeToClose, useRef, useState } from '../../shell/runtime.js'

export function menuRow(props) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef(null)
  useEscapeToClose(open, () => setOpen(false))
  const { Menu, Button, label, value, values } = props
  const nameOf = props.name === undefined ? (entry) => entry : props.name
  const current = values.includes(value) ? value : values[0]
  return h(
    'div',
    { className: 'cs-ed-row' },
    h('span', { className: 'cs-ed-label' }, label),
    h(
      'span',
      { className: 'cs-ed-anchor', ref: anchorRef },
      h(Button, { variant: 'outline', size: 'sm', onClick: () => setOpen(true) }, nameOf(current)),
    ),
    h(Menu, {
      open,
      anchorRef,
      portal: true,
      align: 'end',
      side: 'bottom',
      selectedId: current,
      items: values.map((entry) => ({ id: entry, label: nameOf(entry) })),
      onSelect: (id) => {
        setOpen(false)
        props.onSelect(id)
      },
      onClose: () => setOpen(false),
    }),
  )
}
