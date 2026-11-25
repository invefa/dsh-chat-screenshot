import { BLOCK_ATTRIBUTE, ZONE_ATTRIBUTE } from '../../shell/const.js'

/**
 * Dragging a block into the picture.
 *
 * The payload rides on dataTransfer, but a drag that starts inside the overlay cannot always read it
 * back, so the last payload is also kept here.
 */

const ZONES = ['top', 'bottom']

/**
 * Where a dragged block would land.
 *
 * The pointer decides the zone and the position inside it: above the middle of the copy is the zone
 * above the transcript, below it is the one under it, and inside a zone the block lands between the
 * blocks whose centre the pointer has passed. Both are read from the copy in the document, so the same
 * answer holds whether the pointer came from the palette or from another block.
 */
function dropTarget(clone, host, clientY) {
  if (host === null) return null
  const box = clone.getBoundingClientRect()
  if (box.height < 1) return null
  // The indicator is drawn inside the overlay, so the position is expressed in the overlay's frame.
  const wrap = host.parentElement
  const wrapBox = (wrap ?? host).getBoundingClientRect()
  const zone = clientY < box.top + box.height / 2 ? 'top' : 'bottom'
  const wrapper = clone.querySelector(`[${ZONE_ATTRIBUTE}="${zone}"]`)
  const blocks = wrapper === null ? [] : Array.from(wrapper.querySelectorAll(`[${BLOCK_ATTRIBUTE}]`))
  let index = 0
  let line = wrapper === null ? box.top + (zone === 'top' ? 0 : box.height) : wrapper.getBoundingClientRect().top
  for (const node of blocks) {
    const rect = node.getBoundingClientRect()
    line = rect.top
    if (clientY > rect.top + rect.height / 2) {
      index += 1
      line = rect.bottom
    } else break
  }
  return { zone, index, y: Math.round(line - wrapBox.top) }
}

/** The payload a drag carries. */
const BLOCK_PAYLOAD = 'application/x-cs-block'
let dragging = null

/**
 * The overlay.
 */
/**
 * The payload of the drag that is in flight.
 */
export function readDrag() {
  return dragging
}

/**
 * Replace the payload of the drag that is in flight. One slot is enough: only one drag can run.
 */
export function writeDrag(payload) {
  dragging = payload
}
