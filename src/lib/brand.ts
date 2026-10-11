// Il panda ingegnere di EasyPDF, in SVG. Usato dall'interfaccia e dallo script
// che genera le icone dell'app (scripts/make-icons.ts).

export const colors = {
  coral: '#EE5A3A',
  violet: '#5B3FD6',
  sun: '#F4B63C',
  sunDark: '#E09F22',
  ink: '#1E1B2E',
  cream: '#FBF7F1',
  blush: '#F7D2C6',
};

const c = colors;

/** Logo completo: panda con caschetto, occhiali, foglio PDF e matita. */
export function pandaFull(id = 'ep'): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<defs><clipPath id="${id}-clip"><rect width="120" height="120" rx="20"/></clipPath></defs>
<rect width="120" height="120" rx="20" fill="${c.coral}"/>
<g clip-path="url(#${id}-clip)">
<ellipse cx="60" cy="122" rx="36" ry="30" fill="#fff"/>
<ellipse cx="30" cy="112" rx="12" ry="20" fill="${c.ink}"/>
<ellipse cx="90" cy="112" rx="12" ry="20" fill="${c.ink}"/>
<circle cx="31" cy="39" r="10" fill="${c.ink}"/>
<circle cx="89" cy="39" r="10" fill="${c.ink}"/>
<ellipse cx="60" cy="61" rx="29" ry="25" fill="#fff"/>
<path d="M34 45 Q34 19 60 19 Q86 19 86 45 Z" fill="${c.sun}"/>
<rect x="57" y="20" width="6" height="24" fill="${c.sunDark}"/>
<rect x="27" y="42" width="66" height="6" rx="2" fill="${c.sunDark}"/>
<ellipse cx="49" cy="61" rx="7" ry="9.5" fill="${c.ink}" transform="rotate(30 49 61)"/>
<ellipse cx="71" cy="61" rx="7" ry="9.5" fill="${c.ink}" transform="rotate(-30 71 61)"/>
<circle cx="50" cy="60" r="3" fill="#fff"/><circle cx="50.6" cy="60.6" r="1.6" fill="${c.ink}"/>
<circle cx="70" cy="60" r="3" fill="#fff"/><circle cx="70.6" cy="60.6" r="1.6" fill="${c.ink}"/>
<rect x="39" y="52" width="19" height="15" rx="4" fill="none" stroke="${c.violet}" stroke-width="2.8"/>
<rect x="62" y="52" width="19" height="15" rx="4" fill="none" stroke="${c.violet}" stroke-width="2.8"/>
<path d="M58 57 Q60 55 62 57" stroke="${c.violet}" stroke-width="2.5" fill="none"/>
<path d="M39 56 L32 53 M81 56 L88 53" stroke="${c.violet}" stroke-width="2.5" stroke-linecap="round"/>
<path d="M56.5 69 h7 q0 4 -3.5 4 q-3.5 0 -3.5 -4z" fill="${c.ink}"/>
<path d="M56.5 75.5 Q60 79 63.5 75.5" stroke="${c.ink}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
<g transform="rotate(-7 62 102)">
<path d="M45 86 h25 l8 8 v32 h-33z" fill="${c.cream}" stroke="${c.ink}" stroke-width="1.6" stroke-linejoin="round"/>
<path d="M70 86 v8 h8" fill="${c.blush}" stroke="${c.ink}" stroke-width="1.6" stroke-linejoin="round"/>
<rect x="49" y="92" width="15" height="7" rx="1.5" fill="${c.coral}"/>
<path d="M51.2 97.6v-4.2h1.5a1.2 1.2 0 0 1 0 2.4h-1.5 M55.2 97.6v-4.2h1.1a2.1 2.1 0 0 1 0 4.2z M59.6 97.6v-4.2h2.4 M59.6 95.4h1.9" stroke="#fff" stroke-width=".9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M49 104 h24 M49 109 h20 M49 114 h23" stroke="#C9BFD9" stroke-width="2" stroke-linecap="round"/>
</g>
<ellipse cx="43" cy="104" rx="6.5" ry="8" fill="${c.ink}"/>
<g transform="rotate(35 80 100)"><rect x="77" y="80" width="6" height="22" rx="1" fill="${c.sun}"/><path d="M77 102 h6 l-3 6z" fill="${c.blush}"/><path d="M79.2 106.4 l0.8 1.6 l0.8 -1.6z" fill="${c.ink}"/><rect x="77" y="78" width="6" height="3" fill="${c.violet}"/></g>
<ellipse cx="84" cy="96" rx="6.5" ry="7.5" fill="${c.ink}"/>
</g>
</svg>`;
}

/** Muso del panda: per le dimensioni piccole (barra, Dock, schermata Home, favicon). */
export function pandaFace(opts: { rounded?: boolean; scale?: number } = {}): string {
  const { rounded = true, scale = 1 } = opts;
  const t = (1 - scale) * 60;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<rect width="120" height="120" ${rounded ? 'rx="22"' : ''} fill="${c.coral}"/>
<g transform="translate(${t} ${t}) scale(${scale})">
<circle cx="27" cy="42" r="14" fill="${c.ink}"/><circle cx="93" cy="42" r="14" fill="${c.ink}"/>
<ellipse cx="60" cy="70" rx="40" ry="35" fill="#fff"/>
<path d="M24 50 Q24 14 60 14 Q96 14 96 50 Z" fill="${c.sun}"/>
<rect x="56" y="15" width="8" height="33" fill="${c.sunDark}"/>
<rect x="15" y="46" width="90" height="9" rx="3" fill="${c.sunDark}"/>
<ellipse cx="45" cy="72" rx="10" ry="13" fill="${c.ink}" transform="rotate(30 45 72)"/>
<ellipse cx="75" cy="72" rx="10" ry="13" fill="${c.ink}" transform="rotate(-30 75 72)"/>
<circle cx="46" cy="70" r="4" fill="#fff"/><circle cx="74" cy="70" r="4" fill="#fff"/>
<circle cx="46.8" cy="70.8" r="2" fill="${c.ink}"/><circle cx="74.8" cy="70.8" r="2" fill="${c.ink}"/>
<rect x="31" y="60" width="26" height="21" rx="5" fill="none" stroke="${c.violet}" stroke-width="4.5"/>
<rect x="63" y="60" width="26" height="21" rx="5" fill="none" stroke="${c.violet}" stroke-width="4.5"/>
<path d="M57 66 Q60 63 63 66" stroke="${c.violet}" stroke-width="4" fill="none"/>
<path d="M55 86 h10 q0 5 -5 5 q-5 0 -5 -5z" fill="${c.ink}"/>
</g>
</svg>`;
}
