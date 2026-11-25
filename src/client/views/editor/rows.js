/**
 * One labelled menu of a few values, built from the host's own components: the row every choice in
 * the inspector is made of.
 */
import { h, useState } from '../../shell/runtime.js'

export function menuRow(props) {
  const [open, setOpen] = useState(false)
  const { Menu, Button, label, value, values } = props
  const nameOf = props.name === undefined ? (entry) => entry : props.name
  const current = values.includes(value) ? value : values[0]
  return h(
    'div',
    { className: 'cs-ed-row' },
    h('span', { className: 'cs-ed-label' }, label),
    h(Button, { variant: 'outline', size: 'sm', onClick: () => setOpen(true) }, nameOf(current)),
    h(Menu, {
      open,
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
