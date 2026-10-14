// The plane, side view, nose to the right, in one constant SVG string per pose
// (byte-stable across redraws). Motion is SMIL inside the markup: no script,
// no handlers, no redraws from the mod.

export type Pose = 'flying' | 'cruise' | 'thinking' | 'holding' | 'turbulence' | 'celebrate' | 'parked' | 'landed'

const INK = '#3B2A22'

function plane(pose: Pose): string {
  const isMoving = pose !== 'parked' && pose !== 'landed'
  const bob =
    pose === 'flying'
      ? '<animateTransform attributeName="transform" type="translate" values="-3 1;0 -1;3 0" dur="1.5s" repeatCount="1" fill="freeze"/>'
      : isMoving
        ? '<animateTransform attributeName="transform" type="translate" values="0 0;0 -1.2;0 0" dur="1.6s" repeatCount="indefinite"/>'
        : ''
  const shake =
    pose === 'turbulence'
      ? '<animateTransform attributeName="transform" type="rotate" values="-7 16 16;7 16 16;-7 16 16" dur="0.32s" repeatCount="indefinite" additive="sum"/>'
      : pose === 'holding'
        ? '<animateTransform attributeName="transform" type="rotate" values="0 16 16;-9 16 16;0 16 16;9 16 16;0 16 16" dur="2.6s" repeatCount="indefinite" additive="sum"/>'
        : pose === 'celebrate'
          ? '<animateTransform attributeName="transform" type="rotate" values="0 16 16;-360 16 16" dur="1.2s" repeatCount="2" additive="sum"/>'
          : ''
  const prop = isMoving
    ? '<animateTransform attributeName="transform" type="scale" values="1 1;1 0.12;1 1" dur="0.18s" repeatCount="indefinite"/>'
    : ''
  const trail = isMoving
    ? `<g stroke="#9CA3AF" stroke-width="1.2" stroke-linecap="round"><line x1="0.5" y1="15" x2="3" y2="15"><animate attributeName="opacity" values="0.15;0.8;0.15" dur="0.8s" repeatCount="indefinite"/></line><line x1="1" y1="18.5" x2="3.5" y2="18.5"><animate attributeName="opacity" values="0.8;0.15;0.8" dur="0.8s" repeatCount="indefinite"/></line></g>`
    : ''
  const extra =
    pose === 'holding'
      ? `<circle cx="25" cy="6.5" r="5" fill="#FFFFFF" stroke="${INK}" stroke-width="0.8"/><text x="25" y="9" font-size="7" text-anchor="middle" font-family="sans-serif" fill="${INK}">?</text>`
      : pose === 'thinking'
        ? `<g fill="${INK}">${[20, 23.5, 27].map((x, i) => `<circle cx="${x}" cy="7" r="1"><animate attributeName="opacity" values="0.2;1;0.2" dur="0.9s" begin="${i * 0.3}s" repeatCount="indefinite"/></circle>`).join('')}</g>`
        : pose === 'celebrate'
          ? `<g fill="#E3A647"><path d="M26 4 l1 2 2 1 -2 1 -1 2 -1 -2 -2 -1 2 -1z"/><path d="M5 5 l0.8 1.6 1.6 0.8 -1.6 0.8 -0.8 1.6 -0.8 -1.6 -1.6 -0.8 1.6 -0.8z"/></g>`
          : pose === 'landed' || pose === 'parked'
            ? `<line x1="2" y1="26" x2="30" y2="26" stroke="#9CA3AF" stroke-width="1" stroke-dasharray="2 2"/>`
            : ''
  const lift = pose === 'landed' || pose === 'parked' ? ' transform="translate(0 4)"' : ''
  const light =
    pose === 'parked'
      ? `<circle cx="8" cy="10" r="0.9" fill="#E34B4B"><animate attributeName="opacity" values="1;1;0.1;1" keyTimes="0;0.85;0.92;1" dur="4s" repeatCount="indefinite"/></circle>`
      : ''

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><g${lift}><g>${bob}${shake}${trail}` +
    `<path d="M5 16 L5 9 L8.5 9 L11 15 Z" fill="#D97757" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>` +
    `<path d="M4.5 15.5 Q4.5 13.8 7 13.8 L22 13.8 Q27 13.8 27 16.6 Q27 19.4 22 19.4 L7 19.4 Q4.5 19.4 4.5 17.6 Z" fill="#D97757" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>` +
    `<rect x="19.5" y="14.8" width="3.6" height="2" rx="0.6" fill="#E8F1FA" stroke="${INK}" stroke-width="0.6"/>` +
    `<circle cx="16" cy="15.9" r="0.7" fill="${INK}"/><circle cx="13.6" cy="15.9" r="0.7" fill="${INK}"/>` +
    `<path d="M12 17.5 L18.5 17.5 L15 24 L11 24 Z" fill="#C2603F" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>` +
    `<g transform="translate(27.6 16.6)"><g>${prop}<line x1="0" y1="-5" x2="0" y2="5" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/></g></g>` +
    `${light}</g>${extra}</g></svg>`
  )
}

export const SPRITES: Record<Pose, string> = {
  flying: plane('flying'),
  cruise: plane('cruise'),
  thinking: plane('thinking'),
  holding: plane('holding'),
  turbulence: plane('turbulence'),
  celebrate: plane('celebrate'),
  parked: plane('parked'),
  landed: plane('landed'),
}

export const CONFETTI = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">${['#D97757', '#1F5C9E', '#2B744A', '#A3216B', '#E3A647', '#D97757', '#1F5C9E', '#2B744A']
  .map(
    (color, i) =>
      `<rect x="${3 + i * 3.4}" y="26" width="2.2" height="3.2" fill="${color}"><animate attributeName="y" values="26;-6" dur="${1 + (i % 3) * 0.3}s" begin="${i * 0.08}s" repeatCount="3" fill="freeze"/></rect>`,
  )
  .join('')}</svg>`

// The terminal draws no Svg: one glyph per pose.
export const GLYPHS: Record<Pose, string> = {
  flying: '✈',
  cruise: '✈',
  thinking: '✈…',
  holding: '✈?',
  turbulence: '✈!',
  celebrate: '✈*',
  parked: '✈',
  landed: '⚑',
}
