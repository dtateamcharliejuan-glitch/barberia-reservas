// Ilustraciones propias (sin fotos de stock): portada animada e iconos de servicio.
// Todo en trazo latón; el movimiento vive en css/styles.css (.scene …).

// Portada: poste de barbería con franjas que suben y tijeras que abren y cierran.
export const heroScene = `
<svg class="scene" viewBox="0 0 360 240" role="img" aria-label="Poste de barbería girando y unas tijeras cortando">
  <defs>
    <clipPath id="tube"><rect x="226" y="52" width="44" height="136" rx="22"/></clipPath>
    <pattern id="stripes" width="44" height="66" patternUnits="userSpaceOnUse" patternTransform="skewY(-34)">
      <rect width="44" height="66" fill="#efe6d8"/>
      <rect y="0" width="44" height="16" fill="#b8432f"/>
      <rect y="33" width="44" height="16" fill="#2f5179"/>
    </pattern>
  </defs>

  <!-- Poste -->
  <g class="pole">
    <g clip-path="url(#tube)">
      <rect class="pole-stripes" x="226" y="-80" width="44" height="400" fill="url(#stripes)"/>
      <rect x="226" y="52" width="14" height="136" fill="#fff" opacity=".14"/>
      <rect x="258" y="52" width="12" height="136" fill="#000" opacity=".22"/>
    </g>
    <rect x="226" y="52" width="44" height="136" rx="22" fill="none" stroke="#d4a65a" stroke-width="2.5"/>
    <path d="M220 52h56a6 6 0 0 0-6-12h-44a6 6 0 0 0-6 12z" fill="#d4a65a"/>
    <circle cx="248" cy="32" r="9" fill="#d4a65a"/>
    <path d="M220 188h56a6 6 0 0 1-6 12h-44a6 6 0 0 1-6-12z" fill="#d4a65a"/>
    <rect x="243" y="200" width="10" height="14" rx="2" fill="#d4a65a"/>
  </g>

  <!-- Tijeras: cada mitad gira sobre el eje -->
  <g class="scissors" transform="translate(120 128) rotate(-28)">
    <g class="blade blade-top">
      <path d="M-4 -5 L78 -2.5 Q82 0 78 1.5 L-2 5 Z" fill="#f4ede3"/>
      <path d="M-4 -5 L78 -2.5 Q82 0 78 1.5" fill="none" stroke="#d4a65a" stroke-width="1.5"/>
      <path d="M-2 -3 L-38 -16" stroke="#d4a65a" stroke-width="5" stroke-linecap="round"/>
      <circle cx="-52" cy="-22" r="15" fill="none" stroke="#d4a65a" stroke-width="5"/>
    </g>
    <g class="blade blade-bottom">
      <path d="M-4 5 L78 2.5 Q82 0 78 -1.5 L-2 -5 Z" fill="#e3d6c2"/>
      <path d="M-4 5 L78 2.5 Q82 0 78 -1.5" fill="none" stroke="#d4a65a" stroke-width="1.5"/>
      <path d="M-2 3 L-38 16" stroke="#d4a65a" stroke-width="5" stroke-linecap="round"/>
      <circle cx="-52" cy="22" r="15" fill="none" stroke="#d4a65a" stroke-width="5"/>
    </g>
    <circle r="4.5" fill="#121010" stroke="#d4a65a" stroke-width="2.5"/>
  </g>

  <!-- Recortes de pelo que caen -->
  <g class="snips" stroke="#a89f93" stroke-width="2" stroke-linecap="round">
    <path class="snip s1" d="M196 120l6 3"/>
    <path class="snip s2" d="M204 132l5-2"/>
    <path class="snip s3" d="M192 140l4 4"/>
  </g>
</svg>`;

// Iconos de servicio: 24×24, trazo 1.75, mismo estilo.
export const ICONS = {
  // Corte: tijeras
  scissors: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.6 7.6 20 17M8.6 16.4 20 7"/></svg>',
  // Corte + cejas: ojo con ceja perfilada
  brow: '<svg viewBox="0 0 24 24"><path d="M4 9.5c3.5-3 9.5-3.6 16-1.5"/><path d="M4.5 15c4.5-4.6 10.5-4.6 15 0-4.5 4.6-10.5 4.6-15 0z"/><circle cx="12" cy="15" r="2"/></svg>',
  // Corte + barba: barba con bigote
  beard: '<svg viewBox="0 0 24 24"><path d="M4 7v3c0 6.2 3.6 10 8 10s8-3.8 8-10V7"/><path d="M4 10c1.6 1.4 3.2 2 5 2M20 10c-1.6 1.4-3.2 2-5 2"/><path d="M7.5 14.2c1.8-1.5 3.3-1.2 4.5 0 1.2-1.2 2.7-1.5 4.5 0"/><path d="M10.5 17h3"/></svg>',
};
