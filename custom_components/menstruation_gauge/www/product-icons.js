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

const STATE_ASSET_FILENAMES = {
  period: 'period.svg',
  fertile: 'fertile.svg',
  ovulation: 'ovulation.svg',
  pms: 'pms.svg',
  pre_menarche: 'premenarche.svg',
  menarche: 'premenarche.svg',
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

function getStateAssetUrl(statusKey) {
  const normalized = String(statusKey || '').toLowerCase();
  const assetFilename = STATE_ASSET_FILENAMES[normalized];
  if (!assetFilename) {
    return '';
  }
  return `${ASSET_BASE_URL}/state/${assetFilename}`;
}

function getStateIcon(statusKey, size = 'default') {
  const src = getStateAssetUrl(statusKey);
  if (!src) {
    return '';
  }
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
  const stateAssetIcon = getStateIcon(normalized, size);
  if (stateAssetIcon) return stateAssetIcon;

  if (normalized === 'pregnant') return getPregnancyIcon(undefined, size);
  if (normalized === 'postpartum') return getPostpartumIcon(size);
  if (normalized === 'menopause') return getMenopauseIcon(size);
  return getNeutralStatusIcon(size);
}

function getStatusAnimatedIcon(statusKey, attrs, size = 'default') {
  const normalized = String(statusKey || '').toLowerCase();
  const stateAssetIcon = getStateIcon(normalized, size);
  if (stateAssetIcon) return stateAssetIcon;

  if (normalized === 'pregnant') {
    return getPregnancyIcon(attrs, size);
  }
  if (normalized === 'postpartum') return getPostpartumIcon(size);
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

  const src = getProductAssetUrl(productName);
  if (!src) {
    return null;
  }

  const ns = 'http://www.w3.org/2000/svg';
  const xlinkNs = 'http://www.w3.org/1999/xlink';
  const iconSize = resolveSize(size);
  const maskId = `pi-asset-mask-${Math.random().toString(36).slice(2, 10)}`;

  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('xmlns', ns);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', String(iconSize));
  svg.setAttribute('height', String(iconSize));
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.dataset.assetSrc = src;
  svg.dataset.fillMask = `url(#${maskId})`;

  const defs = document.createElementNS(ns, 'defs');
  const mask = document.createElementNS(ns, 'mask');
  mask.setAttribute('id', maskId);
  mask.setAttribute('x', '0');
  mask.setAttribute('y', '0');
  mask.setAttribute('width', '24');
  mask.setAttribute('height', '24');
  mask.setAttribute('maskUnits', 'userSpaceOnUse');

  const maskImage = document.createElementNS(ns, 'image');
  maskImage.setAttribute('x', '0');
  maskImage.setAttribute('y', '0');
  maskImage.setAttribute('width', '24');
  maskImage.setAttribute('height', '24');
  maskImage.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  maskImage.setAttribute('href', src);
  maskImage.setAttributeNS(xlinkNs, 'xlink:href', src);
  maskImage.addEventListener('error', () => {
    svg.dispatchEvent(new CustomEvent('product-icon-asset-error', {
      bubbles: false,
      detail: { product: productName, src },
    }));
  }, { once: true });
  mask.appendChild(maskImage);
  defs.appendChild(mask);
  svg.appendChild(defs);

  const baseImage = document.createElementNS(ns, 'image');
  baseImage.setAttribute('x', '0');
  baseImage.setAttribute('y', '0');
  baseImage.setAttribute('width', '24');
  baseImage.setAttribute('height', '24');
  baseImage.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  baseImage.setAttribute('href', src);
  baseImage.setAttributeNS(xlinkNs, 'xlink:href', src);
  baseImage.setAttribute('class', 'anim-product-asset');
  baseImage.setAttribute('opacity', '0.95');
  baseImage.addEventListener('error', () => {
    svg.dispatchEvent(new CustomEvent('product-icon-asset-error', {
      bubbles: false,
      detail: { product: productName, src },
    }));
  }, { once: true });
  svg.appendChild(baseImage);

  return svg;
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
  getStateAssetUrl,
  getStateIcon,
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
