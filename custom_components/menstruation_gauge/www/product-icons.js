/**
 * Shared product icon definitions for all menstrual cards.
 */

const ASSET_BASE_URL = '/menstruation_gauge/assets';

const PRODUCT_ASSET_FILENAMES = {
  tampon: 'tampon.svg',
  pad: 'pad.svg',
  cup: 'menstrual_cup.svg',
  liner: 'pantyliner.svg',
  underwear: 'period_panty.svg',
};

const PREGNANCY_ASSET_FILENAMES = {
  1: 'preg_01.svg',
  2: 'preg_02.svg',
  3: 'preg_03.svg',
  4: 'preg_04.svg',
  5: 'preg_05.svg',
  6: 'preg_06.svg',
  7: 'preg_07.svg',
  8: 'preg_08.svg',
  9: 'preg_09.svg',
};

const PRODUCT_ICON_PATHS = {
  // tampon.svg
  tampon: '<path d="M9.5 3.1C9.5 2.22 10.22 1.5 11.1 1.5H12.9C13.78 1.5 14.5 2.22 14.5 3.1V14.4C14.5 15.96 13.23 17.22 11.68 17.22H12.32C10.77 17.22 9.5 15.96 9.5 14.4V3.1Z" fill="currentColor" stroke="none"/><path d="M12 17.2V20.8"/><path d="M12 20.8C12 22.2 13.15 23.35 14.55 23.35"/>',
  // pad.svg
  pad: '<path d="M12 2.6C9.86 2.6 8.12 4.34 8.12 6.48V17.52C8.12 19.66 9.86 21.4 12 21.4C14.14 21.4 15.88 19.66 15.88 17.52V6.48C15.88 4.34 14.14 2.6 12 2.6Z" fill="currentColor" stroke="none"/><path d="M8.2 8.2C6.38 8.2 4.9 9.68 4.9 11.5C4.9 13.32 6.38 14.8 8.2 14.8"/><path d="M15.8 8.2C17.62 8.2 19.1 9.68 19.1 11.5C19.1 13.32 17.62 14.8 15.8 14.8"/>',
  // menstrual_cup.svg
  cup: '<path d="M8.4 2.7H15.6V4.3C15.6 6.19 15.11 8.05 14.19 9.7L13.5 10.93V14.1C13.5 15.76 12.16 17.1 10.5 17.1H13.5C11.84 17.1 10.5 15.76 10.5 14.1V10.93L9.81 9.7C8.89 8.05 8.4 6.19 8.4 4.3V2.7Z" fill="currentColor" stroke="none"/><path d="M12 17.1V21.1"/><path d="M10.7 21.1H13.3"/>',
  // pantyliner.svg
  liner: '<path d="M12 7.3C8.46 7.3 5.6 9.34 5.6 11.86C5.6 14.39 8.46 16.43 12 16.43C15.54 16.43 18.4 14.39 18.4 11.86C18.4 9.34 15.54 7.3 12 7.3Z" fill="currentColor" stroke="none"/><path d="M8.8 11.9H15.2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.45"/>',
  // period_panty.svg
  underwear: '<path d="M4 5.3H20L19.14 10.58C18.56 14.13 15.49 16.74 11.9 16.74H12.1C8.51 16.74 5.44 14.13 4.86 10.58L4 5.3Z"/><path d="M4 5.3H8.2L9.8 10.56C10.12 11.6 11.08 12.31 12.17 12.31H11.83C12.92 12.31 13.88 11.6 14.2 10.56L15.8 5.3H20"/><path d="M8.65 6.7H15.35L14.16 10.1C13.87 10.95 13.07 11.52 12.17 11.52H11.83C10.93 11.52 10.13 10.95 9.84 10.1L8.65 6.7Z" fill="currentColor" opacity="0.45" stroke="none"/>',
};

const PRODUCT_KEY_ALIASES = {
  period_underwear: 'underwear',
};

const ICON_SIZES = {
  default: 24,
  small: 14,
  large: 48,
};

const ANIMATION_EASING = 'cubic-bezier(0.4, 0, 0.2, 1)';

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

function resolveStrokeWidth(size) {
  const iconSize = resolveSize(size);
  return Math.max(1.2, Math.min(2.2, iconSize / 13));
}

function parsePositiveInt(value) {
  const normalized = parseInt(String(value ?? '').trim(), 10);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return null;
  }
  return normalized;
}

function clampInt(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildMaskedAssetIcon(src, size = 'default') {
  const iconSize = resolveSize(size);
  return `<span aria-hidden="true" style="display:block;width:${iconSize}px;height:${iconSize}px;flex:0 0 auto;background-color:currentColor;-webkit-mask:url('${src}') center / contain no-repeat;mask:url('${src}') center / contain no-repeat;"></span>`;
}

function buildIconSvg(content, size = 'default', options = {}) {
  const iconSize = resolveSize(size);
  const strokeWidth = resolveStrokeWidth(size);
  const styleTag = options.style ? `<style>${options.style}</style>` : '';
  const svgStyle = options.svgStyle ? ` style="${options.svgStyle}"` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="currentColor" stroke-width="${strokeWidth.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${svgStyle}>${styleTag}${content}</svg>`;
}

// Converts a pregnancy week number (1–40) to a display month (1–9).
// Always interprets the input as weeks; callers that have a month value should
// use it directly via clampInt rather than passing it here.
function weeksToPregnancyMonth(weeks) {
  const rawValue = parsePositiveInt(weeks);
  if (rawValue === null) {
    return 1;
  }

  return clampInt(Math.ceil(rawValue / 4), 1, 9);
}

function resolvePregnancyInfo(source = {}) {
  const isObjectSource = source !== null && typeof source === 'object';
  const pregnancyData = isObjectSource && source.pregnancy_data && typeof source.pregnancy_data === 'object'
    ? source.pregnancy_data
    : {};
  const weeksValue = parsePositiveInt(
    isObjectSource
      ? (source.weeks_pregnant
        ?? source.pregnancy_week
        ?? source.week
        ?? pregnancyData.weeks_pregnant
        ?? pregnancyData.pregnancy_week
        ?? pregnancyData.week)
      : source,
  );
  const monthValue = parsePositiveInt(
    isObjectSource
      ? (source.pregnancy_month
        ?? source.month
        ?? pregnancyData.pregnancy_month
        ?? pregnancyData.month)
      : null,
  );
  const trimesterValue = parsePositiveInt(
    isObjectSource
      ? (source.pregnancy_trimester
        ?? source.trimester
        ?? pregnancyData.pregnancy_trimester
        ?? pregnancyData.trimester)
      : null,
  );
  const month = monthValue !== null ? clampInt(monthValue, 1, 9) : weeksToPregnancyMonth(weeksValue);
  const week = weeksValue !== null ? clampInt(weeksValue, 1, 40) : clampInt((((month - 1) * 4) + 1), 1, 40);
  const trimester = trimesterValue !== null
    ? clampInt(trimesterValue, 1, 3)
    : clampInt(weeksValue !== null ? Math.ceil(week / 13) : Math.ceil(month / 3), 1, 3);
  const stateKey = isObjectSource ? String(source.state || '').toLowerCase() : '';
  const isPregnant = isObjectSource
    ? Boolean(source.is_pregnant ?? source.isPregnant ?? pregnancyData.is_pregnant ?? pregnancyData.isPregnant) || stateKey === 'pregnant'
    : true;

  return { isPregnant, week, month, trimester };
}

function getPregnancyIcon(monthOrWeeks, size = 'default') {
  const pregnancyInfo = resolvePregnancyInfo(monthOrWeeks);
  const assetFilename = PREGNANCY_ASSET_FILENAMES[pregnancyInfo.month] || PREGNANCY_ASSET_FILENAMES[1];
  const src = `${ASSET_BASE_URL}/pregnancy/${assetFilename}`;
  return buildMaskedAssetIcon(src, size);
}

function getPostpartumIcon(size = 'default') {
  const iconContent = `
    <circle cx="12" cy="6.3" r="3"/>
    <path d="M7.4 20.4V18.8C7.4 16.1 9.6 13.9 12.3 13.9H11.7C14.4 13.9 16.6 16.1 16.6 18.8V20.4"/>
    <path d="M9.6 11.3H14.4"/>
    <circle cx="10.8" cy="6.3" r="0.25" fill="currentColor"/>
    <circle cx="13.2" cy="6.3" r="0.25" fill="currentColor"/>
  `;
  return buildIconSvg(iconContent, size);
}

function getMenopauseIcon(size = 'default') {
  return buildIconSvg('<path d="M20.5 13.2A8.8 8.8 0 1 1 10.8 3.5A7 7 0 0 0 20.5 13.2Z"/>', size);
}

function getPeriodIcon(size = 'default') {
  const iconStyle = `
    @keyframes pi-period-float {
      0%, 100% { transform: translateY(0); opacity: 1; }
      50% { transform: translateY(-2px); opacity: 0.85; }
    }
    @keyframes pi-period-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    .pi-period-root {
      transform-origin: 12px 12px;
      animation: pi-period-float 2.5s ease-in-out infinite;
    }
    .pi-period-drop {
      animation: pi-period-pulse 2.5s ease-in-out infinite;
    }
  `;
  const iconContent = `
    <g class="pi-period-root">
      <path class="pi-period-drop" d="M12 2.2C12 2.2 6.9 9.2 6.9 13.2A5.1 5.1 0 1 0 17.1 13.2C17.1 9.2 12 2.2 12 2.2Z"/>
    </g>
  `;
  return buildIconSvg(iconContent, size, {
    style: iconStyle,
    svgStyle: 'color: var(--error-color, #e74c3c);',
  });
}

function getOvulationIcon(size = 'default') {
  const iconStyle = `
    @keyframes pi-ov-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.75; }
    }
    @keyframes pi-ov-rotate {
      0%, 100% { transform: rotate(0deg); }
      50% { transform: rotate(10deg); }
    }
    @keyframes pi-ov-orbit {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .pi-ov-core {
      transform-origin: 12px 12px;
      animation: pi-ov-pulse 3s ease-in-out infinite;
    }
    .pi-ov-orbit {
      transform-origin: 12px 12px;
      animation: pi-ov-orbit 3.5s ${ANIMATION_EASING} infinite;
      opacity: 0.82;
    }
    .pi-ov-outer {
      transform-origin: 12px 12px;
      animation: pi-ov-rotate 3s ease-in-out infinite;
    }
  `;
  const iconContent = `
    <g class="pi-ov-outer">
      <ellipse class="pi-ov-core" cx="12" cy="12.5" rx="4.2" ry="5.2"/>
      <path d="M8.2 12.5C8.6 11.3 9.7 10.5 11 10.5" opacity="0.55"/>
      <g class="pi-ov-orbit">
        <circle cx="12" cy="4.2" r="0.85" fill="currentColor" stroke="none"/>
        <circle cx="18.3" cy="12" r="0.85" fill="currentColor" stroke="none"/>
        <circle cx="12" cy="19.8" r="0.85" fill="currentColor" stroke="none"/>
        <circle cx="5.7" cy="12" r="0.85" fill="currentColor" stroke="none"/>
      </g>
    </g>
  `;
  return buildIconSvg(iconContent, size, { style: iconStyle });
}

function getPMSIcon(size = 'default') {
  const iconStyle = `
    @keyframes pi-pms-jitter {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(1px); }
      75% { transform: translateX(-1px); }
    }
    @keyframes pi-pms-cramp {
      0%, 100% { opacity: 0.7; }
      50% { opacity: 1; }
    }
    .pi-pms-root {
      transform-origin: 12px 12px;
      animation: pi-pms-jitter 2.8s ease-in-out infinite;
    }
    .pi-pms-cramp {
      animation: pi-pms-cramp 2.8s ease-in-out infinite;
    }
  `;
  const iconContent = `
    <g class="pi-pms-root">
      <circle cx="12" cy="5.5" r="2.7"/>
      <path d="M8 19.8V16.5C8 13.9 10.1 11.8 12.7 11.8H11.3C13.9 11.8 16 13.9 16 16.5V19.8"/>
      <path d="M11 6.2Q12 7.1 13 6.2" opacity="0.8"/>
      <path class="pi-pms-cramp" d="M9 15.6C10.3 14.5 11.7 16.7 13 15.6C14.2 14.6 15.4 16.2 16.2 15.6" opacity="0.85"/>
    </g>
  `;
  return buildIconSvg(iconContent, size, { style: iconStyle });
}

function getMenarcheIcon(size = 'default') {
  const iconStyle = `
    @keyframes pi-flower-bloom {
      0%, 100% { transform: scale(0.3); opacity: 0.8; }
      50% { transform: scale(1); opacity: 1; }
    }
    @keyframes pi-petal-unfold {
      0%, 100% { transform: rotate(var(--petal-rot)) translateY(0); }
      50% { transform: rotate(calc(var(--petal-rot) + 45deg)) translateY(-4px); }
    }
    .pi-flower-group {
      transform-origin: 12px 12px;
      animation: pi-flower-bloom 3.8s ${ANIMATION_EASING} infinite;
    }
    .pi-petal {
      transform-origin: 12px 12px;
      animation: pi-petal-unfold 3.8s ${ANIMATION_EASING} infinite;
    }
  `;
  const iconContent = `
    <g class="pi-flower-group">
      <g class="pi-petal" style="--petal-rot:0deg"><ellipse cx="12" cy="8" rx="1.7" ry="3.6"/></g>
      <g class="pi-petal" style="--petal-rot:60deg"><ellipse cx="12" cy="8" rx="1.7" ry="3.6"/></g>
      <g class="pi-petal" style="--petal-rot:120deg"><ellipse cx="12" cy="8" rx="1.7" ry="3.6"/></g>
      <g class="pi-petal" style="--petal-rot:180deg"><ellipse cx="12" cy="8" rx="1.7" ry="3.6"/></g>
      <g class="pi-petal" style="--petal-rot:240deg"><ellipse cx="12" cy="8" rx="1.7" ry="3.6"/></g>
      <g class="pi-petal" style="--petal-rot:300deg"><ellipse cx="12" cy="8" rx="1.7" ry="3.6"/></g>
      <circle cx="12" cy="12" r="1.45" fill="currentColor" stroke="none"/>
    </g>
  `;
  return buildIconSvg(iconContent, size, { style: iconStyle });
}

function getNeutralStatusIcon(size = 'default') {
  return buildIconSvg('<circle cx="12" cy="12" r="7.4"/><path d="M8.7 12h6.6"/>', size);
}

function getStatusIcon(statusKey, size = 'default') {
  const normalized = String(statusKey || '').toLowerCase();

  if (normalized === 'period') return getPeriodIcon(size);
  if (normalized === 'ovulation' || normalized === 'fertile') return getOvulationIcon(size);
  if (normalized === 'pms') return getPMSIcon(size);
  if (normalized === 'pregnant') return getPregnancyIcon(undefined, size);
  if (normalized === 'postpartum') return getPostpartumIcon(size);
  if (normalized === 'pre_menarche' || normalized === 'menarche') return getMenarcheIcon(size);
  if (normalized === 'menopause') return getMenopauseIcon(size);
  return getNeutralStatusIcon(size);
}

function getStatusAnimatedIcon(statusKey, attrs, size = 'default') {
  const normalized = String(statusKey || '').toLowerCase();

  if (normalized === 'pregnant') {
    return getPregnancyIcon(attrs, size);
  }
  if (normalized === 'postpartum') return getPostpartumIcon(size);
  if (normalized === 'pre_menarche' || normalized === 'menarche') return getMenarcheIcon(size);
  if (normalized === 'menopause') return getMenopauseIcon(size);
  return getStatusIcon(normalized, size);
}

function getSvgIcon(productName, size = 'default') {
  const productKey = normalizeProductKey(productName);
  const assetFilename = PRODUCT_ASSET_FILENAMES[productKey];
  if (!assetFilename) {
    return '';
  }

  const src = `${ASSET_BASE_URL}/period/${assetFilename}`;
  return buildMaskedAssetIcon(src, size);
}

function createAnimatedSvgElement(productName, size = 'default') {
  if (typeof document === 'undefined') {
    return null;
  }

  const productKey = normalizeProductKey(productName);
  const iconPath = PRODUCT_ICON_PATHS[productKey];
  if (!iconPath) {
    return null;
  }

  const iconSize = resolveSize(size);
  const strokeWidth = resolveStrokeWidth(size);
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="currentColor" stroke-width="${strokeWidth.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${iconPath}</svg>`;
  const template = document.createElement('template');
  template.innerHTML = svgMarkup.trim();
  return template.content.firstElementChild;
}

function getPregnancyAssetUrl(month) {
  const clamped = clampInt(parsePositiveInt(month) || 1, 1, 9);
  return `${ASSET_BASE_URL}/pregnancy/${PREGNANCY_ASSET_FILENAMES[clamped]}`;
}

function getProductAssetUrl(productName) {
  const productKey = normalizeProductKey(productName);
  const filename = PRODUCT_ASSET_FILENAMES[productKey];
  if (!filename) return '';
  return `${ASSET_BASE_URL}/period/${filename}`;
}

const ProductIcons = {
  getSvgIcon,
  createAnimatedSvgElement,
  getStatusIcon,
  getStatusAnimatedIcon,
  getPeriodIcon,
  getOvulationIcon,
  getPMSIcon,
  weeksToPregnancyMonth,
  resolvePregnancyInfo,
  getPregnancyIcon,
  getPregnancyAssetUrl,
  getProductAssetUrl,
  getPostpartumIcon,
  getMenarcheIcon,
  getMenopauseIcon,
  getIcon(productKey) {
    return getSvgIcon(productKey);
  },
  getIconWithSize(productKey, size = 24) {
    return getSvgIcon(productKey, size);
  },
  getAllProducts() {
    return Object.keys(PRODUCT_ASSET_FILENAMES);
  },
};

if (typeof window !== 'undefined') {
  window.ProductIcons = ProductIcons;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductIcons;
}
