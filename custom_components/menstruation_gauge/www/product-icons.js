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

function buildIconSvg(content, size = 'default', options = {}) {
  const iconSize = resolveSize(size);
  const strokeWidth = resolveStrokeWidth(size);
  const styleTag = options.style ? `<style>${options.style}</style>` : '';
  const svgStyle = options.svgStyle ? ` style="${options.svgStyle}"` : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" fill="none" stroke="currentColor" stroke-width="${strokeWidth.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"${svgStyle}>${styleTag}${content}</svg>`;
}

function calculatePregnancyBellyRadius(weeksPregnant) {
  const weeks = Math.max(1, Math.min(40, parseInt(String(weeksPregnant || '0'), 10) || 1));

  if (weeks <= 13) {
    return 2 + ((weeks - 1) / 12) * 6; // 2-8px
  }
  if (weeks <= 26) {
    return 8 + ((weeks - 14) / 12) * 8; // 8-16px
  }
  return 16 + ((weeks - 27) / 13) * 8; // 16-24px
}

function getPregnancyIcon(weeksPregnant, size = 'default') {
  const bellyRadius = calculatePregnancyBellyRadius(weeksPregnant);
  const iconContent = `
    <circle cx="12" cy="5" r="2.7"/>
    <path d="M9 8.5 Q12 7.5 15 8.5"/>
    <path d="M8.2 9.8C7.2 9.8 6.3 10.8 6.3 11.8V18.2C6.3 19.3 7.2 20.2 8.2 20.2H14.8"/>
    <ellipse cx="15.2" cy="14.2" rx="${bellyRadius.toFixed(1)}" ry="${(bellyRadius * 0.78).toFixed(1)}"/>
    <path d="M9 20.2L8.1 23.2"/>
    <path d="M14.8 20.2L15.7 23.2"/>
  `;
  return buildIconSvg(iconContent, size);
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
  if (normalized === 'pregnant') return getPregnancyIcon(20, size);
  if (normalized === 'postpartum') return getPostpartumIcon(size);
  if (normalized === 'pre_menarche' || normalized === 'menarche') return getMenarcheIcon(size);
  if (normalized === 'menopause') return getMenopauseIcon(size);
  return getNeutralStatusIcon(size);
}

function getStatusAnimatedIcon(statusKey, attrs, size = 'default') {
  const normalized = String(statusKey || '').toLowerCase();

  if (normalized === 'pregnant') {
    const weeksRaw = attrs?.weeks_pregnant !== undefined ? attrs.weeks_pregnant : attrs?.pregnancy_week;
    const weeksPregnant = Math.max(0, parseInt(String(weeksRaw || '0'), 10) || 0);
    return getPregnancyIcon(weeksPregnant, size);
  }
  if (normalized === 'postpartum') return getPostpartumIcon(size);
  if (normalized === 'pre_menarche' || normalized === 'menarche') return getMenarcheIcon(size);
  if (normalized === 'menopause') return getMenopauseIcon(size);
  return getStatusIcon(normalized, size);
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
  getStatusIcon,
  getStatusAnimatedIcon,
  getPeriodIcon,
  getOvulationIcon,
  getPMSIcon,
  getPregnancyIcon,
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
    return Object.keys(PRODUCT_ICON_PATHS);
  },
};

if (typeof window !== 'undefined') {
  window.ProductIcons = ProductIcons;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductIcons;
}
