/* ==========================================================================
   Dreikanter photo — icons.js
   线性图标集（stroke 风格，24 网格）
   ========================================================================== */
'use strict';

const ICON_PATHS = {
  /* ---- 工具 ---- */
  move: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  marquee: '<rect x="3.6" y="4.6" width="16.8" height="14.8" rx="1" stroke-dasharray="3.2 2.6"/>',
  ellipse: '<ellipse cx="12" cy="12" rx="8.4" ry="7.4" stroke-dasharray="3.2 2.6"/>',
  lasso: '<path d="M5 15.5c-1.2-1.1-1.9-2.6-1.9-4.2C3.1 7.1 7.1 4 12 4s8.9 3.1 8.9 7.3-4 7.3-8.9 7.3c-1.6 0-3.1-.3-4.3-.9"/><path d="M5 15.5c.5 2 .2 3.4-1.2 4.6"/>',
  wand: '<path d="M14.5 4.5l5 5M16.8 2.6l.7 2.1 2.1.7-2.1.7-.7 2.1-.7-2.1-2.1-.7 2.1-.7z"/><path d="M13.4 8.4L4.6 17.2a1.6 1.6 0 002.2 2.2l8.8-8.8"/><path d="M6.4 3.4l.5 1.6 1.6.5-1.6.5-.5 1.6-.5-1.6L4.4 5.5l1.6-.5z"/>',
  crop: '<path d="M6.5 2.5v15h15M2.5 6.5h15v15"/>',
  picker: '<path d="M15.2 3.4a2.6 2.6 0 013.7 0l1.7 1.7a2.6 2.6 0 010 3.7l-2.1 2.1-5.4-5.4z"/><path d="M13 7.6L4.4 16.2 3 21l4.8-1.4 8.6-8.6"/>',
  brush: '<path d="M9.5 14.5l-1.2 4.2a2 2 0 01-2.4 1.4L3 19.3l1-2.7a2 2 0 011.4-1.2l4.1-1"/><path d="M9.5 14.5L18.8 4a2.1 2.1 0 013 .3l.3.3a2.1 2.1 0 01-.2 3L12.2 17.4z"/>',
  eraser: '<path d="M8.4 20.5H20"/><path d="M15.6 3.9l4.5 4.5a2 2 0 010 2.8l-7.6 7.6a2 2 0 01-2.8 0l-4.5-4.5a2 2 0 010-2.8l7.6-7.6a2 2 0 012.8 0z"/><path d="M8.6 8.1l7.3 7.3"/>',
  bucket: '<path d="M10.2 3.6l8.9 8.9a1.8 1.8 0 010 2.5l-5.3 5.3a1.8 1.8 0 01-2.5 0L4 13.2a1.8 1.8 0 010-2.5l6.2-6.2z"/><path d="M4.6 12.4h14"/><path d="M20.5 15.4c.9 1.4 1.4 2.4 1.4 3.1a1.6 1.6 0 11-3.2 0c0-.7.5-1.7 1.8-3.1z"/>',
  gradient: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 16.2h17M3.5 12.6h12M3.5 19.4h6" opacity=".85"/><path d="M3.5 9h17" opacity=".55"/>',
  blur: '<path d="M12 3.5c3.4 4.2 6.2 7.4 6.2 10.6a6.2 6.2 0 11-12.4 0C5.8 10.9 8.6 7.7 12 3.5z"/><path d="M9.2 14.4a2.9 2.9 0 002.9 2.9" opacity=".7"/>',
  dodge: '<circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.6M12 19.4V22M2 12h2.6M19.4 12H22M5 5l1.9 1.9M17.1 17.1L19 19M19 5l-1.9 1.9M6.9 17.1L5 19"/>',
  burn: '<path d="M12 3s4 4.6 4 8a4 4 0 11-8 0c0-1.4.6-2.6 1.4-3.8.4 1.2 1 1.8 1.6 2 .6-2 .9-4 1-6.2z"/><path d="M4.5 20.5h15" opacity=".5"/>',
  text: '<path d="M4.5 6.2V4.5h15v1.7M12 4.8v14.4M9 19.4h6"/>',
  shape: '<rect x="3.6" y="3.6" width="9.4" height="9.4" rx="1"/><circle cx="15.6" cy="15.6" r="4.9"/>',
  hand: '<path d="M8.2 11V5.4a1.6 1.6 0 013.2 0V11M11.4 10.4V3.9a1.6 1.6 0 013.2 0v6.5M14.6 10.6V5.2a1.6 1.6 0 013.2 0v8.6"/><path d="M8.2 11.6L6.8 10a1.7 1.7 0 00-2.5 2.3l4.6 6.1a5.2 5.2 0 004.2 2.1h.6a5.4 5.4 0 005.4-5.4v-2.6a1.6 1.6 0 00-3.2 0"/>',
  zoom: '<circle cx="10.6" cy="10.6" r="6.7"/><path d="M15.6 15.6L21 21M8 10.6h5.2M10.6 8v5.2"/>',

  /* ---- 界面 ---- */
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V4.4h5v2.1M6.6 6.5l.9 13.1h9l.9-13.1"/><path d="M10.3 10v6.2M13.7 10v6.2" opacity=".6"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V5.6a1.6 1.6 0 00-1.6-1.6H5.6A1.6 1.6 0 004 5.6v8.3a1.6 1.6 0 001.6 1.6h2.9"/>',
  merge: '<path d="M12 3v9M8.4 8.4L12 12l3.6-3.6"/><rect x="3.6" y="14.5" width="16.8" height="6" rx="1.6"/>',
  eye: '<path d="M2.6 12S6 5.9 12 5.9 21.4 12 21.4 12S18 18.1 12 18.1 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="2.9"/>',
  eyeOff: '<path d="M4 4.5l16 15"/><path d="M9.4 6.4A9.6 9.6 0 0112 6.1c6 0 9.4 5.9 9.4 5.9a17 17 0 01-3.3 4M6.2 8.1A16.6 16.6 0 002.6 12s3.4 5.9 9.4 5.9a9.7 9.7 0 003.5-.65"/>',
  lock: '<rect x="5.2" y="10.4" width="13.6" height="9.6" rx="2"/><path d="M8.4 10.4V7.8a3.6 3.6 0 017.2 0v2.6"/>',
  layers: '<path d="M12 3.5l8.6 4.6L12 12.7 3.4 8.1z"/><path d="M3.4 12.4L12 17l8.6-4.6M3.4 16.5L12 21.1l8.6-4.6"/>',
  history: '<path d="M3.8 12a8.2 8.2 0 108.2-8.2 8.2 8.2 0 00-6.5 3.2"/><path d="M3.4 3.6v4.2h4.2M12 7.6V12l3 2"/>',
  sliders: '<path d="M5 3.5v6M5 14.5v6M12 3.5v9M12 17.5v3M19 3.5v3M19 11.5v9"/><circle cx="5" cy="12" r="2.3"/><circle cx="12" cy="14.7" r="2.3"/><circle cx="19" cy="8.6" r="2.3"/>',
  sparkles: '<path d="M12 3.2l1.9 4.6 4.6 1.9-4.6 1.9L12 16.2l-1.9-4.6L5.5 9.7l4.6-1.9z"/><path d="M18.6 15.4l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8zM5 16.5l.5 1.3 1.3.5-1.3.5L5 20.1l-.5-1.3-1.3-.5 1.3-.5z"/>',
  code: '<path d="M8.4 7.5L3.5 12l4.9 4.5M15.6 7.5L20.5 12l-4.9 4.5M13.6 4.5l-3.2 15"/>',
  image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="8.6" cy="9.6" r="1.7"/><path d="M3.8 16.5l4.6-4.2a1.8 1.8 0 012.4 0l3.2 3 2-1.8a1.8 1.8 0 012.4 0l3.2 2.9"/>',
  folder: '<path d="M3.5 7.5h6l2 2.5h9v9.5h-17z"/><path d="M3.5 7.5V5h12"/>',
  save: '<path d="M4.5 4.5h11.2L19.5 8v11.5h-15z"/><path d="M8 4.5v5h7v-5M8 19.5v-6h8v6"/>',
  undo: '<path d="M8.5 5.5L4 10l4.5 4.5"/><path d="M4 10h9.5a5.5 5.5 0 010 11H10"/>',
  redo: '<path d="M15.5 5.5L20 10l-4.5 4.5"/><path d="M20 10h-9.5a5.5 5.5 0 000 11H14"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  chevronRight: '<path d="M9 6l6 6-6 6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6"/>',
  grid: '<rect x="3.5" y="3.5" width="17" height="17" rx="1.6"/><path d="M3.5 9.2h17M3.5 14.9h17M9.2 3.5v17M14.9 3.5v17"/>',
  download: '<path d="M12 3.5v12M7.5 11l4.5 4.5 4.5-4.5"/><path d="M4 19.5h16"/>',
  upload: '<path d="M12 20.5v-12M7.5 13L12 8.5l4.5 4.5"/><path d="M4 4.5h16"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  dots: '<circle cx="5.5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.5" cy="12" r="1.4"/>',
  rotate: '<path d="M4.5 12a7.5 7.5 0 107.5-7.5c-2.3 0-4.3 1-5.7 2.6"/><path d="M4 3.5v4.6h4.6"/>',
  flip: '<path d="M12 3.5v17" stroke-dasharray="2.5 2.5"/><path d="M9.4 6.5L4 12l5.4 5.5zM14.6 6.5L20 12l-5.4 5.5z"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 100 17c1.4 0 2-.9 2-1.9 0-1.6-1.7-1.7-1.7-3.1 0-1 .8-1.8 2-1.8h1.6a4.6 4.6 0 004.6-4.6C20.5 6 16.7 3.5 12 3.5z"/><circle cx="7.6" cy="10.4" r="1.2"/><circle cx="10.4" cy="7.2" r="1.2"/><circle cx="14.6" cy="7.6" r="1.2"/>',
  info: '<circle cx="12" cy="12" r="8.6"/><path d="M12 11v5.4M12 7.9v.2"/>',
  star: '<path d="M12 3.6l2.7 5.7 6.2.8-4.5 4.3 1.1 6.1-5.5-3-5.5 3 1.1-6.1L3.1 10l6.2-.8z"/>',
  film: '<rect x="3.5" y="4.5" width="17" height="15" rx="1.8"/><path d="M7.5 4.5v15M16.5 4.5v15M3.5 9h4M3.5 15h4M16.5 9h4M16.5 15h4"/>',
  contrast: '<circle cx="12" cy="12" r="8.6"/><path d="M12 3.4v17.2" /><path d="M12 3.4a8.6 8.6 0 010 17.2z" fill="currentColor" stroke="none"/>',
  droplet: '<path d="M12 3.4c3.5 4.3 6.3 7.5 6.3 10.8a6.3 6.3 0 11-12.6 0C5.7 10.9 8.5 7.7 12 3.4z"/>',
  crop2: '<path d="M7 3v13.5h14"/><path d="M3 7h13.5v14"/>',
  more: '<path d="M4 8h16M4 16h16"/>',
  layersPlus: '<path d="M12 3.5l8.6 4.6L12 12.7 3.4 8.1z"/><path d="M3.4 12.4L12 17l8.6-4.6"/><path d="M18.4 16.6v4.4M16.2 18.8h4.4"/>',
  target: '<circle cx="12" cy="12" r="8.4"/><circle cx="12" cy="12" r="3.6"/><path d="M12 1.6v3M12 19.4v3M1.6 12h3M19.4 12h3"/>',
  bolt: '<path d="M13.4 2.5L4.8 13.2h5.6l-1.2 8.3 8.8-10.9h-5.6z"/>'
};

function icon(name, size = 16, extraClass = '') {
  const p = ICON_PATHS[name] || ICON_PATHS.info;
  return `<svg class="ico ${extraClass}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
}
function iconEl(name, size = 16) {
  const d = document.createElement('div');
  d.innerHTML = icon(name, size);
  return d.firstElementChild;
}
