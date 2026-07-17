/**
 * Compatibility wrapper around shared menstrual icon utility.
 */

const ProductIcons = {
  getIcon(productKey) {
    return window.MenstrualIcons?.getSvgIcon(productKey) || '';
  },

  getIconWithSize(productKey, size = 24) {
    return window.MenstrualIcons?.getSvgIcon(productKey, size) || '';
  },

  getAllProducts() {
    return ['tampon', 'pad', 'cup', 'liner', 'underwear'];
  },
};

if (typeof window !== 'undefined') {
  window.ProductIcons = ProductIcons;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProductIcons;
}
