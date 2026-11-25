/**
 * Every number and marker the capture depends on, in one place.
 *
 * The values fall into three groups: canvas limits the browser imposes, the
 * geometry of the crop, and the DOM markers the host puts on its own layout.
 * A marker that changes in the host only has to change here.
 */

/** Chromium rejects a canvas past roughly 268M pixels; this budget leaves room for GPU paths. */
export const MAX_AREA = 120_000_000

/** Per-side canvas limit. A capture taller than this has to be scaled down. */
export const MAX_SIDE = 16_000

/** A 1x capture reads soft at natural size, so the picture is drawn at 2x when it fits. */
export const DEFAULT_SCALE = 2

/** Below this factor a picture stops being readable; the crop is clamped rather than shrinking further. */
export const MIN_SCALE = 0.3

/** Vertical breathing room added above and below the cropped band, in CSS pixels. */
export const EDGE_PADDING = 24

/** The narrowest transcript the crop will produce, in CSS pixels. */
export const MIN_WIDTH = 320

/** An icon larger than this is left unpainted: serializing it risks a hung decode. */
export const ICON_MAX_EDGE = 256

/** Serialized SVG icons past this length are dropped for the same reason. */
export const ICON_MAX_SOURCE = 100_000

/** How long the rasterizer waits for an SVG document or one icon to decode. */
export const SVG_TIMEOUT = 20_000
export const ICON_TIMEOUT = 5_000

/** How long the clone waits for its images before painting without them. */
export const IMAGE_TIMEOUT = 6_000

/** How long one clipboard write may stay pending before it counts as refused. */
export const CLIPBOARD_TIMEOUT = 9_000

/** Budget for draining the history, and for one paging click to take effect. */
export const HISTORY_BUDGET = 150_000
export const PAGE_EFFECT_TIMEOUT = 6_000

/** A scrollport counts as settled after this many equal measurements, one per tick. */
export const STABLE_TICKS = 4
export const STABLE_TICK_MS = 250

/** Attributes the host puts on chrome that must never reach the picture. */
export const SKIP_ATTRIBUTES = [
  'data-composer-seat',
  'data-composer-stat',
  'data-composer-stats',
  'data-dsh-screenshot-skip',
]

/**
 * The paging control's own labels, lower case, grouped by the state they report.
 *
 * The host renders one button that carries all five labels at once and hides the inactive ones with
 * `aria-hidden` and a class, so the control's text content is the concatenation of every state. The
 * label therefore has to be read from the visible subtree, and the state has to be classified: the
 * control stays mounted after the last page, it only turns `disabled` and switches to `start`, which
 * is why "the control unmounted" is not the end of the history.
 */
export const PAGING_STATES = [
  {
    state: 'more',
    labels: [
      '加载更早',
      '载入更早',
      '加载历史',
      'load older',
      'load earlier',
      'older messages',
      'earlier messages',
    ],
  },
  { state: 'retry', labels: ['重新加载', '重试加载', 'retry loading'] },
  {
    state: 'busy',
    labels: ['正在加载', '正在载入', '加载中', 'loading earlier', 'loading older', 'processing', '正在处理'],
  },
  {
    state: 'start',
    labels: ['已到会话开头', '会话开头', 'start of conversation', 'start of chat', 'beginning of conversation'],
  },
]

/** Padding presets offered in the settings, in CSS pixels. */
export const EDGE_CHOICES = [8, 24, 40]

/** Scale factors offered in the settings; `auto` keeps the largest factor the canvas budget allows. */
export const SCALE_CHOICES = ['auto', '1', '2', '3']

/** Text alignment of the inserted blocks. */
export const ALIGN_CHOICES = ['left', 'center']

/**
 * The picture's own content: a list of blocks above the transcript and below it.
 *
 * A block is one thing the reader put there on purpose — a line of text, a gap, an image, a rule, the
 * date line — so what surrounds the transcript is data rather than a set of named fields. The two
 * zones are the only places a capture can add anything, because the SVG path serializes the clone and
 * nothing may be laid out beside it.
 */
export const BLOCK_ZONES = ['top', 'bottom']

/** The kinds the library offers, in the order the palette lists them. */
export const BLOCK_KINDS = ['text', 'spacer', 'image', 'divider', 'meta']

/** Type sizes a text block can be drawn at. */
export const TEXT_SIZES = ['title', 'subtitle', 'body']

/** Caps: the blocks and saved components live in one storage key and are applied to every capture. */
export const MAX_BLOCKS = 24
export const MAX_CUSTOM = 12
export const BLOCK_TEXT_CHARS = 400
export const BLOCK_NAME_CHARS = 40
export const SPACER_MIN = 4
export const SPACER_MAX = 240
export const IMAGE_WIDTH_MIN = 10
export const IMAGE_WIDTH_MAX = 100
export const IMAGE_MAX_CHARS = 800_000

/**
 * Tokens a text block can carry.
 *
 * The values come from the conversation the capture is taken from — how many turns it holds, what it
 * is called, which model answered, what day it is — so a header can describe the shot it is part of
 * instead of repeating one fixed sentence on every picture.
 */
export const TEMPLATE_TOKENS = [
  'turns',
  'prompts',
  'date',
  'time',
  'weekday',
  'title',
  'model',
  'session',
  'app',
  'version',
]

/** Marks one block in the copy, and the zone wrapper that holds the blocks of one zone. */
export const BLOCK_ATTRIBUTE = 'data-dsh-screenshot-block'
export const ZONE_ATTRIBUTE = 'data-dsh-screenshot-zone'

/**
 * Host markers for the subtrees the settings can hide. Each is matched by attribute, never by one of
 * its values: the host reuses the same marker for both sides of an exchange.
 */
export const PROCESS_ATTRIBUTE = 'data-turn-process'
export const STEP_PROCESS_ATTRIBUTE = 'data-step-process'
export const ATTACHMENTS_ATTRIBUTE = 'data-message-attachments'

/**
 * The paging control's wrapper. The button inside it stays mounted after the last page, so the
 * wrapper is a piece of chrome the reader can keep or drop like any other.
 */
export const HISTORY_ATTRIBUTE = 'data-chat-history'

/** Theme tokens consulted for the page background, in order. */
export const BACKGROUND_TOKENS = ['--dsw-alias-bg-base', '--dsw-alias-bg-layer-1']

/** Marks the staged clone and its holder, so both can be found and removed again. */
export const STAGE_ATTRIBUTE = 'data-dsh-screenshot-stage'
export const HOLDER_ATTRIBUTE = 'data-dsh-screenshot-holder'

/** Marks the blocks the settings can add above and below the transcript. */
export const HEAD_ATTRIBUTE = 'data-dsh-screenshot-head'
export const FOOT_ATTRIBUTE = 'data-dsh-screenshot-foot'

/**
 * The edit surface: the overlay that stands in the conversation's place, and the tag that makes any
 * piece of the staged copy clickable. Both are ours, so they are attributes rather than classes.
 */
export const EDITOR_ATTRIBUTE = 'data-dsh-screenshot-editor'
export const PIECE_ATTRIBUTE = 'data-dsh-screenshot-piece'
export const FIELD_ATTRIBUTE = 'data-dsh-screenshot-field'

/** Host markers the crop and the turn band are read from. */
export const SCROLL_ATTRIBUTE = 'data-conversation-scroll'
export const TURN_ATTRIBUTE = 'data-chat-turn'
export const TURN_TAIL_ATTRIBUTE = 'data-turn-tail'
export const USER_FLOW_KIND = 'data-chat-flow-kind="user"'
export const TURN_SPACER_ATTRIBUTE = 'data-chat-turn-spacer'
export const WIDTH_HANDLE_ATTRIBUTE = 'data-width-handle'
/**
 * The metadata row every turn ends with: the clock, the per-turn usage and the hover-only action
 * icons. The host renders it twice per exchange, `data-clock="start"` under the user's message and
 * `data-clock="end"` under the answer, so the marker is matched without its value.
 */
export const CLOCK_ROW_ATTRIBUTE = 'data-clock'

/** Depth the clone is walked when pruning skipped subtrees. */
export const PRUNE_DEPTH = 12

/**
 * How much of the opening message a turn chooser shows. The label is read from the user message and
 * clipped, because a menu row is one line and the message itself can be a paragraph.
 */
export const TURN_LABEL_CHARS = 48

/**
 * The floating "back to bottom" control. Its wrapper carries the host's `toBottomSlot` class, the
 * only language-independent handle on it, because the button's own label is translated.
 */
export const TO_BOTTOM_SLOT = '[class*="toBottomSlot"]'

/**
 * Measure diagnostics: when true, the capture reads every cloned element's box and logs the crop
 * numbers. It is off by default because the sweep forces a full layout query on a long transcript
 * for information that only helps while the host's layout is being matched.
 */
export const DEBUG_MEASURE = false

/**
 * Rules the reader writes on arbitrary elements.
 *
 * A rule is a selector plus what to do with what it matches, so the picture is not limited to the
 * chrome this plugin happens to know: a host release that adds a row, and another plugin that paints
 * one, are both reachable. The caps exist because the rules are stored in the page and applied to
 * every capture: a pasted wall of CSS would be paid for on each shot.
 */
export const MAX_RULES = 40
export const RULE_NAME_CHARS = 40
export const RULE_SELECTOR_CHARS = 240
export const RULE_VALUE_CHARS = 120
export const RULE_ATTR_CHARS = 60

/**
 * The properties the element inspector offers.
 *
 * These are the ones a transcript actually needs to be re-shaped for a picture: what is drawn, how
 * loud it is, how much room it takes and how it aligns. Inline declarations win over the host's
 * stylesheet, and they survive serialization into the SVG, which is what makes a preview and a
 * capture show the same thing.
 */
export const STYLE_PROPS = [
  'display',
  'visibility',
  'opacity',
  'color',
  'background',
  'border',
  'border-radius',
  'box-shadow',
  'padding',
  'margin',
  'gap',
  'font-size',
  'font-weight',
  'font-family',
  'line-height',
  'letter-spacing',
  'text-align',
  'text-decoration',
  'white-space',
  'width',
  'max-width',
  'height',
  'max-height',
  'overflow',
  'align-self',
  'justify-content',
  'filter',
  'transform',
]

/** Style bundles offered as one click in the inspector. */
export const RULE_PRESETS = [
  { id: 'dim', style: { opacity: '0.35' } },
  { id: 'mark', style: { outline: '1px dashed currentColor' } },
  { id: 'tight', style: { padding: '0', margin: '0' } },
  { id: 'plain', style: { background: 'transparent', border: '0', 'box-shadow': 'none' } },
  { id: 'mono', style: { 'font-family': 'ui-monospace, SFMono-Regular, Menlo, monospace' } },
  { id: 'small', style: { 'font-size': '12px', 'line-height': '1.35' } },
]

/** How long a hidden element is shown in place when its chip is clicked. */
export const PEEK_MS = 1600

/**
 * What the capture's own hiding does to a matched element: it stays in the copy with no box, so a
 * capture measures the transcript without it while the edit surface can still show where it was.
 */
export const HIDE_STYLE = { display: 'none' }
