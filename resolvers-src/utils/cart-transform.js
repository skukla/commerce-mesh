/**
 * CART TRANSFORMATION UTILITIES
 *
 * Centralized cart transformation functions following Citisignal patterns.
 * Transforms Adobe Commerce cart structures into semantic, frontend-ready shapes.
 * Uses same patterns as product-transform.js for consistency.
 *
 * NOTE: This file uses module.exports for the build script to process.
 * The functions will be injected inline into resolvers at build time.
 * Dependencies on price-utils will be injected as well.
 */

/**
 * Transform Adobe Commerce cart to semantic Citisignal shape
 * Follows same pattern as transformProductToCard
 * @param {object} adobeCart - Raw Adobe Commerce cart object
 * @returns {object|null} Transformed semantic cart or null if invalid
 */
const transformCartToSemantic = (adobeCart) => {
  if (!adobeCart) return null;

  const items = (adobeCart.items || []).map(transformCartItemToSemantic).filter(Boolean);

  // Calculate business fields (like your hasMoreItems pattern)
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);
  const totalValue = items.reduce((total, item) => total + item.totalValue, 0);

  return {
    id: adobeCart.id,
    itemCount,
    totalValue,
    totalDisplay: formatPrice(totalValue), // Uses injected price formatting
    items,
    isEmpty: itemCount === 0, // Calculated business field
  };
};

/**
 * Transform Adobe Commerce cart item to semantic shape
 * Uses semantic image extraction (like your product pattern)
 * @param {object} adobeItem - Raw Adobe Commerce cart item
 * @returns {object|null} Transformed semantic cart item or null if invalid
 */
const transformCartItemToSemantic = (adobeItem) => {
  if (!adobeItem || !adobeItem.product) return null;

  const product = adobeItem.product;
  const quantity = adobeItem.quantity || 1;

  // Extract pricing (following your dual pricing pattern)
  const priceValue = extractCartItemPrice(adobeItem);
  const totalValue = priceValue * quantity;

  // Extract variant display name (like your formatCartItemName)
  const variantDisplay = extractVariantDisplay(adobeItem);

  // Get cart-optimized image (following semantic image pattern)
  const image = extractCartImage(product);

  return {
    id: adobeItem.id,
    productId: product.id,
    sku: product.sku,
    name: product.name,
    quantity,

    // Dual pricing (matching your product pattern)
    priceValue,
    priceDisplay: formatPrice(priceValue),
    totalValue,
    totalDisplay: formatPrice(totalValue),

    // Semantic image (uses existing getCartImage utility)
    image,

    // Configuration details
    selectedOptions: extractSelectedOptions(adobeItem),
    variantDisplay,
  };
};

/**
 * Extract cart-optimized image for display
 * Prioritizes thumbnail, falls back to main image
 * @param {object} product - Adobe Commerce product data
 * @returns {object|null} Image object or null if no image
 */
const extractCartImage = (product) => {
  // Try to get thumbnail first (Adobe Commerce role-based)
  const thumbnail = (product.media_gallery || []).find(
    (img) => img.role === 'thumbnail' && img.url
  );

  if (thumbnail) {
    return {
      url: thumbnail.url,
      altText: product.name || 'Product image',
    };
  }

  // Fall back to main image
  const mainImage = (product.media_gallery || []).find(
    (img) => (img.role === 'image' || img.role === 'base' || !img.role) && img.url
  );

  if (mainImage) {
    return {
      url: mainImage.url,
      altText: product.name || 'Product image',
    };
  }

  // Try the direct thumbnail field
  if (product.thumbnail && product.thumbnail.url) {
    return {
      url: product.thumbnail.url,
      altText: product.name || 'Product image',
    };
  }

  // If using legacy images field
  if (product.images && product.images.length > 0) {
    return {
      url: product.images[0].url,
      altText: product.name || 'Product image',
    };
  }

  return null;
};

/**
 * Extract cart item price value (raw number)
 * Handles both simple and configurable products
 * @param {object} cartItem - Adobe Commerce cart item
 * @returns {number} Price value as number
 */
const extractCartItemPrice = (cartItem) => {
  // Adobe Commerce provides price in cart item - prioritize unit price over total price
  const price =
    cartItem.prices?.price?.value || // Unit price (preferred)
    cartItem.product?.price_range?.minimum_price?.final_price?.value || // Product fallback
    cartItem.prices?.row_total?.value || // Total price (last resort)
    0;

  return parseFloat(price) || 0;
};

/**
 * Extract variant display text for configurable products
 * Like "Purple, 256GB" for iPhone variants
 * @param {object} cartItem - Adobe Commerce cart item
 * @returns {string|null} Variant display text or null
 */
const extractVariantDisplay = (cartItem) => {
  if (!cartItem.configurable_options) return null;

  return (
    cartItem.configurable_options
      .map((option) => option.value_label)
      .filter(Boolean)
      .join(', ') || null
  );
};

/**
 * Extract selected options for cart item
 * Converts Adobe format to semantic format
 * @param {object} cartItem - Adobe Commerce cart item
 * @returns {array} Array of selected options
 */
const extractSelectedOptions = (cartItem) => {
  if (!cartItem.configurable_options) return [];

  return cartItem.configurable_options.map((option) => ({
    label: option.option_label,
    value: option.value_label,
    attributeCode: option.attribute_code || '',
  }));
};

/**
 * Build Adobe Commerce cart input from semantic input
 * Converts our clean API to Adobe's complex requirements
 * @param {object} semanticInput - Citisignal cart input
 * @param {string} cartId - Adobe Commerce cart ID
 * @returns {object} Adobe Commerce mutation input
 */
const buildAdobeCartInput = (semanticInput, cartId) => {
  const { sku, quantity, selectedOptions } = semanticInput;

  // Determine if product is configurable based on options
  const isConfigurable = selectedOptions && selectedOptions.length > 0;

  if (isConfigurable) {
    return {
      cart_id: cartId,
      cart_items: [
        {
          data: {
            sku,
            quantity,
          },
          selected_options: selectedOptions.map((option) => ({
            option_value: option.value,
            option_id: option.attributeCode, // Adobe Commerce may need option_id
          })),
        },
      ],
    };
  } else {
    return {
      cart_id: cartId,
      cart_items: [
        {
          data: {
            sku,
            quantity,
          },
        },
      ],
    };
  }
};

/**
 * Find existing cart item that matches the product being added
 * Compares SKU and selected options to determine if item already exists
 * @param {object} adobeCart - Current Adobe Commerce cart
 * @param {object} newItem - Item being added (with sku, selectedOptions)
 * @returns {object|null} Existing cart item or null if not found
 */
const findExistingCartItem = (adobeCart, newItem) => {
  if (!adobeCart || !adobeCart.items || !newItem) return null;

  return adobeCart.items.find((cartItem) => {
    // Must match SKU
    if (cartItem.product.sku !== newItem.sku) return false;

    // Check if both have the same configuration
    const cartOptions = cartItem.configurable_options || [];
    const newOptions = newItem.selectedOptions || [];

    // Both must have same number of options
    if (cartOptions.length !== newOptions.length) return false;

    // All options must match
    if (newOptions.length === 0) {
      // Simple product - SKU match is sufficient
      return true;
    }

    // Configurable product - check all options match
    return newOptions.every((newOpt) =>
      cartOptions.some(
        (cartOpt) =>
          cartOpt.attribute_code === newOpt.attributeCode && cartOpt.value_label === newOpt.value
      )
    );
  });
};

/**
 * Build cart update input for Adobe Commerce
 * @param {object} updateInput - Citisignal update input
 * @param {string} cartId - Adobe Commerce cart ID
 * @returns {object} Adobe Commerce update input
 */
const buildCartUpdateInput = (updateInput, cartId) => {
  return {
    cart_id: cartId,
    cart_items: [
      {
        cart_item_id: parseInt(updateInput.cartItemId),
        quantity: updateInput.quantity,
      },
    ],
  };
};

/**
 * Build remove item input for Adobe Commerce
 * @param {string} cartItemId - Cart item ID to remove
 * @param {string} cartId - Adobe Commerce cart ID
 * @returns {object} Adobe Commerce remove input
 */
const buildRemoveItemInput = (cartItemId, cartId) => {
  return {
    cart_id: cartId,
    cart_item_id: parseInt(cartItemId),
  };
};

module.exports = {
  transformCartToSemantic,
  transformCartItemToSemantic,
  extractCartImage,
  extractCartItemPrice,
  extractVariantDisplay,
  extractSelectedOptions,
  buildAdobeCartInput,
  findExistingCartItem,
  buildCartUpdateInput,
  buildRemoveItemInput,
};
