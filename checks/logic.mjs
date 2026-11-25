/**
 * Logic checks for the parts that need no browser: the canvas budget, the XML escaping, the crop, the
 * paging labels and the option normalisation.
 *
 * The budget is worth testing because its failure is silent in the other direction: too small a cap
 * and every long transcript comes out blurry, too large a cap and `toBlob` returns null and the
 * capture reports a PNG encoding failure after a long wait. The readable floor only applies to the
 * area branch; the per-side limit can demand a smaller factor on an absurdly tall frame, and the
 * clamp is what keeps the no-scale case honest.
 */
import { MAX_AREA, MAX_SIDE, MAX_BLOCKS, DEFAULT_SCALE, MIN_SCALE } from '../src/client/shell/const.js'
import { captureScale } from '../src/client/render/scale.js'
import { xmlText, wrapMedia } from '../src/client/render/svg.js'
import { planCrop } from '../src/client/dom/transcript/band.js'
import { classifyPaging } from '../src/client/dom/transcript/paging.js'
import { MAX_RULES } from '../src/client/shell/const.js'
import { normalizeOptions, normalizeRule, normalizeRules, ruleId } from '../src/client/shell/options.js'
import { addBlock, moveBlock, normalizeBlock, normalizeBlocks, readOptions, writeOptions } from '../src/client/shell/options.js'
import { renderTemplate } from '../src/client/dom/clone/tokens.js'

// Node has no localStorage, and the option store is written through it, so the checks carry a tiny
// key/value stand-in. Anything the real store does (JSON, defaults, normalisation) stays under test.
const memory = new Map()
globalThis.localStorage = {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, String(value)),
  removeItem: (key) => memory.delete(key),
}

const problems = []

function check(name, ok, detail) {
  if (!ok) problems.push(`${name}: ${detail}`)
}

/** Assertions on the scale factor for one canvas size. */
function scaleCase(name, width, height, expect) {
  const scale = captureScale(width, height)
  const area = width * height * scale * scale
  if (expect.area) {
    check(name, area <= MAX_AREA + 1, `area ${Math.round(area)} exceeds the budget ${MAX_AREA}`)
  }
  if (expect.side) {
    check(
      name,
      width * scale <= MAX_SIDE + 1 && height * scale <= MAX_SIDE + 1,
      `sides ${Math.round(width * scale)}x${Math.round(height * scale)} exceed ${MAX_SIDE}`,
    )
  }
  if (expect.exact !== undefined) {
    check(name, Math.abs(scale - expect.exact) < 1e-9, `expected ${expect.exact}, got ${scale}`)
  }
  if (expect.floor) {
    check(name, scale >= MIN_SCALE - 1e-9, `scale ${scale} below the readable floor ${MIN_SCALE}`)
  }
  check(name, scale > 0 && scale <= DEFAULT_SCALE, `scale ${scale} outside (0, ${DEFAULT_SCALE}]`)
}

scaleCase('small capture keeps 2x', 800, 1_200, { exact: DEFAULT_SCALE })
scaleCase('boundary capture keeps 2x', 2_000, 7_000, { exact: DEFAULT_SCALE })
scaleCase('tall capture scales to the side limit', 900, 40_000, { side: true })
scaleCase('area-bound capture keeps at least the floor', 4_000, 2_000, { area: true, floor: true })
scaleCase('wide capture scales to the side limit', 20_000, 400, { side: true })
scaleCase('degenerate capture still returns a factor', 1, 1, {})

check(
  'scale is monotonic in height',
  captureScale(1_000, 5_000) >= captureScale(1_000, 50_000),
  'a taller canvas must not get a larger factor',
)

const escaped = xmlText(`<p a="x">tom & jerry's</p>`)
check(
  'xmlText escapes markup',
  escaped === '&lt;p a=&quot;x&quot;&gt;tom &amp; jerry&apos;s&lt;/p&gt;',
  `got ${escaped}`,
)

// The harvest reads sheet text from the source element, so a `media` attribute has to come along:
// without it a print or narrow-screen sheet would apply to the picture unconditionally.
check(
  'a sheet media attribute wraps the text',
  wrapMedia('a{color:red}', 'screen and (min-width: 900px)') ===
    '@media screen and (min-width: 900px){a{color:red}}',
  `got ${wrapMedia('a{color:red}', 'screen and (min-width: 900px)')}`,
)
for (const media of [null, '', 'all']) {
  check(
    `media ${JSON.stringify(media)} is unwrapped`,
    wrapMedia('a{color:red}', media) === 'a{color:red}',
    `got ${wrapMedia('a{color:red}', media)}`,
  )
}

// Crop planning: the two failures this guards against are the clone's extra height being clamped
// back to the live one, and a bottom that ends above the transcript's last row.
function cropCase(name, input, expect) {
  const crop = planCrop(input)
  if (expect.top !== undefined) {
    check(name, crop.top === expect.top, `top ${crop.top}, expected ${expect.top}`)
  }
  if (expect.height !== undefined) {
    check(name, crop.height === expect.height, `height ${crop.height}, expected ${expect.height}`)
  }
}

cropCase(
  'crop runs from the first turn to the last',
  { measured: 4_000, scrollerTop: 60, firstTurnTop: 120, lastTurnBottom: 3_800 },
  { top: 120, height: 3_680 },
)

cropCase(
  'a card laid out after the last turn is kept whole',
  { measured: 4_000, scrollerTop: 60, firstTurnTop: 120, lastTurnBottom: 3_800, contentBottom: 3_940 },
  { top: 120, height: 3_820 },
)

cropCase(
  'a clone taller than the live scroll height keeps its last row',
  { measured: 4_120, scrollerTop: 60, firstTurnTop: 120, lastTurnBottom: 4_100, contentBottom: 4_100 },
  { top: 120, height: 3_980 },
)

cropCase(
  'a bottom past the clone is clamped to the clone',
  { measured: 4_000, scrollerTop: 60, firstTurnTop: 120, lastTurnBottom: 4_400, contentBottom: 4_400 },
  { top: 120, height: 3_880 },
)

cropCase(
  'an empty transcript still yields a band',
  { measured: 300, scrollerTop: 40, firstTurnTop: Infinity, lastTurnBottom: 0, contentBottom: 0 },
  { top: 40, height: 260 },
)

// Paging labels: the control carries every state's label at once and hides the inactive ones, so the
// reading has to come from the visible subtree. These cases pin what each label means and, more
// importantly, that the concatenation of all five is not mistaken for a "load more" control — that
// mistake is what kept a capture waiting on a disabled button.
for (const [label, expect] of [
  ['加载更早', 'more'],
  ['已到会话开头', 'start'],
  ['正在加载', 'busy'],
  ['重新加载', 'retry'],
  ['load earlier', 'more'],
  ['start of conversation', 'start'],
  ['', null],
  ['this reply is about loading earlier pages', null],
  ['加载更早正在加载正在处理重新加载已到会话开头', null],
]) {
  const got = classifyPaging(label)
  check(
    `label ${JSON.stringify(label)} classifies`,
    got === expect,
    `got ${JSON.stringify(got)}, expected ${JSON.stringify(expect)}`,
  )
}

// Options: a stored value can be hand-edited, half-written or older than the presets, so every read
// lands on an offered value and the capture never has to defend itself.
const defaults = normalizeOptions(null)
check('empty options fall back to the defaults', defaults.edge === 24 && defaults.hideClock === true, 'defaults drifted')
check('a preset is kept', normalizeOptions({ edge: 40, align: 'center' }).edge === 40, 'edge 40 was not kept')
check('an unknown margin lands on the nearest preset', normalizeOptions({ edge: 100 }).edge === 40, 'edge was not clamped')
check('a margin between presets lands on the closer one', normalizeOptions({ edge: 20 }).edge === 24, 'edge picked the wrong preset')
check('an unknown scale falls back to auto', normalizeOptions({ scale: '9' }).scale === 'auto', 'scale was not rejected')
check('an unknown alignment falls back to left', normalizeOptions({ align: 'justify' }).align === 'left', 'align was not rejected')
check('a switch that is not a boolean keeps its default', normalizeOptions({ hideClock: 'yes' }).hideClock === true, 'a string flipped a switch')
// Blocks: the picture's content is user data too, so a stored block is normalised on the way in and
// a broken one is dropped rather than painted.
const textBlock = normalizeBlock({ kind: 'text', text: '  hello  ', size: 'title', zone: 'top' })
check('a text block keeps its text', textBlock !== null && textBlock.text === 'hello', JSON.stringify(textBlock))
check('a text block keeps its zone', textBlock !== null && textBlock.zone === 'top', JSON.stringify(textBlock))
check('an unknown block kind is dropped', normalizeBlock({ kind: 'video' }) === null, 'kept')
const spacer = normalizeBlock({ kind: 'spacer', height: 900 })
check('a spacer is clamped', spacer !== null && spacer.height === 240, JSON.stringify(spacer))
const image = normalizeBlock({ kind: 'image', src: 'https://example.com/a.png' })
check('a remote image is refused', image === null, JSON.stringify(image))
const dataImage = normalizeBlock({ kind: 'image', src: 'data:image/png;base64,AAAA', width: 50 })
check('a data image is kept', dataImage !== null && dataImage.width === 50, JSON.stringify(dataImage))
const capped = normalizeBlocks(Array.from({ length: 40 }, () => ({ kind: 'divider' })))
check('blocks are capped', capped.length === MAX_BLOCKS, String(capped.length))

// Two zones, each contiguous: a block can move between them and the order inside a zone is preserved.
writeOptions({
  blocks: [
    { id: 'a', kind: 'divider', zone: 'top' },
    { id: 'b', kind: 'divider', zone: 'bottom' },
  ],
})
const moved = moveBlock('b', 'top', 0)
const afterMove = readOptions()
check('a block moves between zones', moved !== null && afterMove.blocks[0].id === 'b' && afterMove.blocks[1].id === 'a', JSON.stringify(afterMove.blocks))
const added = addBlock('bottom', { kind: 'spacer' })
const afterAdd = readOptions()
check('a block can be added', added !== null && afterAdd.blocks[afterAdd.blocks.length - 1].id === added.id, JSON.stringify(afterAdd.blocks))
writeOptions({ blocks: [] })

// The old shape of the settings still exists in the wild, so it is migrated instead of dropped.
const legacy = normalizeOptions({ title: 'Hi', subtitle: 'There', footer: 'Bye', showMeta: true, divider: true }).blocks
check('legacy text becomes blocks', legacy.some((block) => block.kind === 'text' && block.text === 'Hi'), JSON.stringify(legacy))
check('legacy metadata becomes a meta block', legacy.some((block) => block.kind === 'meta'), JSON.stringify(legacy))

// The inserted blocks: the meta line is formatted once and the reader's own placeholders are filled
// from it, so the picture never prints an unresolved `{date}`.
const values = { turns: '7', date: '2026-11-25', time: '09:05', title: 'T', model: 'M', session: 'S', app: 'A', version: 'V', prompts: '3', weekday: 'Tue' }
check(
  'tokens are filled',
  renderTemplate('{turns} | {date} {time}', values) === '7 | 2026-11-25 09:05',
  `got ${renderTemplate('{turns} | {date} {time}', values)}`,
)
check('unknown tokens survive', renderTemplate('{nope}', values) === '{nope}', 'an unknown token was eaten')
check('a brace that is not a token survives', renderTemplate('{ a }', values) === '{ a }', 'the braces were eaten')
check('a token can repeat', renderTemplate('{title}/{title}', values) === 'T/T', 'a repeat was not filled')

// --- rules ------------------------------------------------------------------------------------
// A rule is user data read back from storage, so everything about it is a claim to verify: the id
// has to be stable across reloads, a broken selector has to disappear rather than throw, and a
// style or attribute the plugin does not understand has to be dropped instead of reaching the DOM.
const ruleA = normalizeRule({ selector: '.alpha', name: 'Alpha', hide: true, style: { opacity: '0.3', nope: 'x' }, attrs: { 'data-x': '1', style: 'color:red' } })
check('a rule keeps its selector', ruleA !== null && ruleA.selector === '.alpha', JSON.stringify(ruleA))
check('a rule drops unknown style properties', ruleA !== null && ruleA.style.opacity === '0.3' && ruleA.style.nope === undefined, JSON.stringify(ruleA?.style))
check('a rule refuses to set style and class', ruleA !== null && ruleA.attrs['data-x'] === '1' && ruleA.attrs.style === undefined && ruleA.attrs.class === undefined, JSON.stringify(ruleA?.attrs))
check('an empty selector is not a rule', normalizeRule({ selector: '   ' }) === null, 'kept')
check('a selector is trimmed and capped', normalizeRule({ selector: '  .b  ' })?.selector === '.b', 'not trimmed')

const idA = ruleId('.alpha')
check('an id is stable', idA === ruleId('.alpha') && idA !== ruleId('.beta'), `${idA}/${ruleId('.beta')}`)
check('an id is printable', /^r[0-9a-z]+$/.test(idA), idA)

const many = normalizeRules([
  { selector: '.alpha', hide: true },
  { selector: '.alpha', hide: false },
  { selector: '.beta', style: { color: 'red' } },
  { selector: '' },
])
check('rules dedupe by selector, last one wins', many.length === 2 && many[0].hide === false, JSON.stringify(many.map((rule) => [rule.selector, rule.hide])))
check('rules are capped', normalizeRules(Array.from({ length: MAX_RULES + 6 }, (_, at) => ({ selector: `.n${at}` }))).length === MAX_RULES, 'cap ignored')
check('options carry the rules', normalizeOptions({ rules: [{ selector: '.alpha' }] }).rules.length === 1, 'dropped')

if (problems.length > 0) {
  for (const problem of problems) console.log(`logic: ${problem}`)
  process.exitCode = 1
} else {
  console.log('logic: ok')
}


