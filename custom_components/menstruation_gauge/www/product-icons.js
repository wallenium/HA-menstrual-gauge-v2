/**
 * Global product icon definitions
 * Provides consistent SVG icons for all period products across all cards
 */

const ProductIcons = {
  tampon: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="9" y="2" width="6" height="15" rx="3"/><line x1="12" y1="17" x2="12" y2="22"/></svg>`,
  
  pad: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="8" y="4" width="8" height="16" rx="4"/><path d="M8 8C5 8 4 11 4 12C4 13 5 16 8 16"/><path d="M16 8C19 8 20 11 20 12C20 13 19 16 16 16"/></svg>`,
  
  cup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M8 3L8 14C8 17.3 9.8 19 12 19C14.2 19 16 17.3 16 14L16 3"/><line x1="8" y1="3" x2="16" y2="3"/><line x1="12" y1="19" x2="12" y2="22"/></svg>`,
  
  liner: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="5" y="9" width="14" height="6" rx="3"/></svg>`,
  
  underwear: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 6L3 10C3 14 6 17 12 17C18 17 21 14 21 10L21 6"/><path d="M3 6L9 6C9 6 10 11 12 11C14 11 15 6 15 6L21 6"/></svg>`,

  /**
   * Get SVG icon for a product
   * @param {string} productKey - Product identifier (tampon, pad, cup, liner, underwear)
   * @returns {string} SVG string
   */
  getIcon(productKey) {
    return this[productKey] || '';
  },

  /**
   * Get SVG icon wrapped with sizing attributes
   * @param {string} productKey - Product identifier
   * @param {number} size - Size in pixels (default: 24)
   * @returns {string} SVG string with width/height attributes
   */
  getIconWithSize(productKey, size = 24) {
    const svg = this.getIcon(productKey);
    if (!svg) return '';
    return svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
  },

  /**
   * Get all product keys
   * @returns {string[]} Array of product identifiers
   */
  getAllProducts() {
    return ['tampon', 'pad', 'cup', 'liner', 'underwear'];
  },
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductIcons;
}
