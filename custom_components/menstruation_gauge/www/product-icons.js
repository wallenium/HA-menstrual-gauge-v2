/**
 * Shared product icon definitions for all menstrual cards.
 */

const PRODUCT_ICON_PATHS = {
  tampon: '<rect x="9" y="2" width="6" height="15" rx="3"/><line x1="12" y1="17" x2="12" y2="22"/>',
  pad: '<rect x="8" y="4" width="8" height="16" rx="4"/><path d="M8 8C5 8 4 11 4 12C4 13 5 16 8 16"/><path d="M16 8C19 8 20 11 20 12C20 13 19 16 16 16"/>',
  cup: '<path d="M8 3L8 14C8 17.3 9.8 19 12 19C14.2 19 16 17.3 16 14L16 3"/><line x1="8" y1="3" x2="16" y2="3"/><line x1="12" y1="19" x2="12" y2="22"/>',
  liner: '<rect x="5" y="9" width="14" height="6" rx="3"/>',
  underwear: '<path d="M3 6L3 10C3 14 6 17 12 17C18 17 21 14 21 10L21 6"/><path d="M3 6L9 6C9 6 10 11 12 11C14 11 15 6 15 6L21 6"/>',
};

const PRODUCT_KEY_ALIASES = {
  period_underwear: 'underwear',
};

const ICON_SIZES = {
  default: 24,
  small: 14,
  large: 48,
};

function normalizeProductKey(productName) {
  const key = String(productName || '').toLowerCase();
  return PRODUCT_KEY_ALIASES[key] || key;
}

function resolveSize(size) {
  if (typeof size === 'number' && Number.isFinite(size) && size > 0) {
    return size;
  }

  const key = String(size || 'default').toLowerCase();
  return ICON_SIZES[key] || ICON_SIZES.default;
}

function getPregnancyIcon(weeksPregnant, size = 'default') {
  const weeks = Math.max(0, Math.min(40, parseInt(String(weeksPregnant || '0'), 10) || 0));
  const bellyRadius = 2 + (weeks / 40) * 22;
  const iconSize = resolveSize(size);

  // Belly ellipse: grows from right side of torso (cx=15, cy=14)
  const bellyPath = `<ellipse cx="15" cy="14" rx="${bellyRadius.toFixed(1)}" ry="${(bellyRadius * 0.85).toFixed(1)}" fill="none" stroke="currentColor" stroke-width="1.6"/>`;

  // Head
  const head = '<circle cx="12" cy="5" r="3" fill="none" stroke="currentColor" stroke-width="1.8"/>';

  // Torso outline (shoulders to hips, leaving right side open for belly)
  const torso = '<path d="M8 9 C7 9 6 10 6 11 L6 18 C6 19 7 20 8 20 L16 20 C17 20 18 19 18 18 L18 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';

  // Shoulder line
  const shoulders = '<path d="M9 8 Q12 7 15 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';

  // Legs
  const legs = '<path d="M9 20 L8 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M15 20 L16 24" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>';

  const svgContent = head + shoulders + torso + bellyPath + legs;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${svgContent}</svg>`;
}

function getSvgIcon(productName, size = 'default') {
  const productKey = normalizeProductKey(productName);
  const iconPath = PRODUCT_ICON_PATHS[productKey];
  if (!iconPath) {
    return '';
  }

  const iconSize = resolveSize(size);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconPath}</svg>`;
}

function createAnimatedSvgElement(productName, size = 'default') {
  if (typeof document === 'undefined') {
    return null;
  }

  const iconMarkup = getSvgIcon(productName, size);
  if (!iconMarkup) {
    return null;
  }

  const template = document.createElement('template');
  template.innerHTML = iconMarkup.trim();
  return template.content.firstElementChild;
}

const ProductIcons = {
  getSvgIcon,
  createAnimatedSvgElement,
  getPregnancyIcon,
  getIcon(productKey) {
    return getSvgIcon(productKey);
  },
  getIconWithSize(productKey, size = 24) {
    return getSvgIcon(productKey, size);
  },
  getAllProducts() {
    return Object.keys(PRODUCT_ICON_PATHS);
  },
};

if (typeof window !== 'undefined') {
  window.ProductIcons = ProductIcons;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductIcons;
}
