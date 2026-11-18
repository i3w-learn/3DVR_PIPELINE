/**
 * The teacher app's icons.
 *
 * Drawn here as plain line drawings, so no icon file is ever fetched and the
 * colour follows the text around it. Every one is 24 by 24.
 */

const PATHS = {
  headset: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h11A2.5 2.5 0 0 1 20 8.5v6a2.5 2.5 0 0 1-2.5 2.5h-2.2a2 2 0 0 1-1.6-.8l-.5-.7a1.5 1.5 0 0 0-2.4 0l-.5.7a2 2 0 0 1-1.6.8H6.500A2.5 2.5 0 0 1 4 14.5z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  play: '<path d="M7 5l12 7-12 7z" fill="currentColor"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="3.2"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor"/>',
  back: '<path d="M12 6l-8 6 8 6zM21 6l-8 6 8 6z" fill="currentColor" stroke-width="1"/>',
  forward: '<path d="M12 6l8 6-8 6zM3 6l8 6-8 6z" fill="currentColor" stroke-width="1"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.500V12l3 2"/>',
  volume: '<path d="M4 9.500v5h3.500L12 18.500v-13L7.500 9.500z" fill="currentColor"/><path d="M15.500 9a4 4 0 0 1 0 6M18 6.500a7.500 7.500 0 0 1 0 11"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.700 9.500a2.400 2.400 0 1 1 3.500 2.100c-.800.500-1.200 1-1.200 1.900"/><path d="M12 16.700v.100"/>',
  grid: '<rect x="4.500" y="4.500" width="6" height="6" rx="1"/><rect x="13.500" y="4.500" width="6" height="6" rx="1"/><rect x="4.500" y="13.500" width="6" height="6" rx="1"/><rect x="13.500" y="13.500" width="6" height="6" rx="1"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  wifiOff: '<path d="M4 4l16 16M8.500 15.500a5 5 0 0 1 5.500-1M5.500 12a9.500 9.500 0 0 1 4-2.300M2.500 8.500A14 14 0 0 1 7 5.800M11 5a14 14 0 0 1 10.500 3.500M15 9.800a9.500 9.500 0 0 1 3.500 2.200"/><path d="M12 19v.100"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.700 0l3-3a4 4 0 0 0-5.700-5.700l-1 1M14 10a4 4 0 0 0-5.700 0l-3 3a4 4 0 0 0 5.700 5.700l1-1"/>',
  battery: '<rect x="3" y="8" width="16" height="9" rx="2"/><path d="M21.500 11v3"/>',
  alert: '<path d="M12 4.500l9 15H3z"/><path d="M12 10v4.500M12 17v.100"/>',
  info: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5.500M12 7.700v.100"/>',
  lock: '<rect x="5.500" y="10.500" width="13" height="9.500" rx="2"/><path d="M8.500 10.500V8a3.500 3.500 0 0 1 7 0v2.500"/>',
  chevron: '<path d="M9 5.500l6.500 6.500L9 18.500"/>',
  eyeOff: '<path d="M4 4l16 16M10 6.300A9.500 9.500 0 0 1 21 12a11 11 0 0 1-2.300 3.300M6.300 7.800A11 11 0 0 0 3 12a9.500 9.500 0 0 0 12.500 5.300M10 10a3 3 0 0 0 4 4"/>',
  eye: '<path d="M3 12a9.500 9.500 0 0 1 18 0 9.500 9.500 0 0 1-18 0z"/><circle cx="12" cy="12" r="3"/>',
  search: '<path d="M12 12v.100M8.500 15.500a5 5 0 1 1 7 0M5.700 18.300a9 9 0 1 1 12.600 0"/>',
  refresh: '<path d="M19.500 8.500A8 8 0 0 0 5 9.500M4.500 15.500A8 8 0 0 0 19 14.500"/><path d="M19.500 4.500v4h-4M4.500 19.500v-4h4"/>',
};

/** @returns {string} the icon as markup, sized by the text around it */
export function icon(name) {
  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name] ?? ''}</svg>`;
}
