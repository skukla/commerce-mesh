/**
 * Field Extensions Resolver
 * Extends Adobe Catalog Service types with computed fields for cleaner data access.
 * Adds manufacturer, pricing, discount, and secure image fields to product views.
 */

// Attribute utilities

const cleanAttributeName = (name) => {
  if (!name) return '';
  // Remove cs_ prefix if present
  return name.startsWith('cs_') ? name.substring(3) : name;
};

const extractAttributeValue = (attributes, attributeName, defaultValue = '') => {
  if (!attributes || !Array.isArray(attributes)) return defaultValue;

  // Look for both cs_ prefixed and clean versions
  const csName = `cs_${attributeName}`;
  const attr = attributes.find(
    (a) =>
      a.name === attributeName || a.name === csName || cleanAttributeName(a.name) === attributeName
  );

  return attr?.value || defaultValue;
};

// ensureHttpsUrl function is injected at build time

// Option extraction

const extractOptionByTitle = (options, title) => {
  if (!options) return null;
  return options.find((opt) => opt.title === title);
};

const extractMemoryOptions = (options) => {
  const memoryOption = extractOptionByTitle(options, 'Memory');
  return memoryOption?.values?.map((v) => v.title) || [];
};

const extractColorOptions = (options) => {
  const colorOption = extractOptionByTitle(options, 'Color');
  return (
    colorOption?.values?.map((v) => ({
      name: v.title,
      hex: v.value || '#000000',
    })) || []
  );
};

// isOnSale and calculateDiscountPercentage functions are injected at build time

module.exports = {
  resolvers: {
    // Field extensions for Catalog_ComplexProductView
    Catalog_ComplexProductView: {
      manufacturer: {
        selectionSet: '{ attributes { name value } }',
        resolve: (root) => {
          return extractAttributeValue(root.attributes, 'manufacturer', 'CitiSignal');
        },
      },
      memory_options: {
        selectionSet:
          '{ options { title values { ... on Catalog_ProductViewOptionValueSwatch { title value } } } }',
        resolve: (root) => {
          return extractMemoryOptions(root.options);
        },
      },
      available_colors: {
        selectionSet:
          '{ options { title values { ... on Catalog_ProductViewOptionValueSwatch { title value } } } }',
        resolve: (root) => {
          return extractColorOptions(root.options);
        },
      },
      is_on_sale: {
        selectionSet:
          '{ priceRange { minimum { regular { amount { value } } final { amount { value } } } } }',
        resolve: (root) => {
          if (!root.priceRange) return false;

          const regular = root.priceRange.minimum.regular.amount.value;
          const final = root.priceRange.minimum.final.amount.value;
          return isOnSale(regular, final);
        },
      },
      display_price: {
        selectionSet: '{ priceRange { minimum { final { amount { value } } } } }',
        resolve: (root) => {
          return root.priceRange?.minimum?.final?.amount?.value || 0;
        },
      },
      display_currency: {
        selectionSet: '{ priceRange { minimum { final { amount { currency } } } } }',
        resolve: (root) => {
          return root.priceRange?.minimum?.final?.amount?.currency || 'USD';
        },
      },
      discount_percentage: {
        selectionSet:
          '{ priceRange { minimum { regular { amount { value } } final { amount { value } } } } }',
        resolve: (root) => {
          if (!root.priceRange) return 0;

          const regular = root.priceRange.minimum.regular.amount.value;
          const final = root.priceRange.minimum.final.amount.value;
          return calculateDiscountPercentage(regular, final);
        },
      },
      in_stock: {
        selectionSet: '{ inStock }',
        resolve: (root) => {
          return root.inStock || false;
        },
      },
      secure_image: {
        selectionSet: '{ images(roles: ["small_image"]) { url label roles } }',
        resolve: (root) => {
          if (!root.images || root.images.length === 0) return null;
          const firstImage = root.images[0];
          return {
            ...firstImage,
            url: ensureHttpsUrl(firstImage.url),
          };
        },
      },
      secure_images: {
        selectionSet: '{ images { url label roles } }',
        resolve: (root) => {
          if (!root.images) return [];
          return root.images.map((image) => ({
            ...image,
            url: ensureHttpsUrl(image.url),
          }));
        },
      },
    },

    // Field extensions for Catalog_SimpleProductView
    Catalog_SimpleProductView: {
      manufacturer: {
        selectionSet: '{ attributes { name value } }',
        resolve: (root) => {
          return extractAttributeValue(root.attributes, 'manufacturer', 'CitiSignal');
        },
      },
      is_on_sale: {
        selectionSet: '{ price { regular { amount { value } } final { amount { value } } } }',
        resolve: (root) => {
          if (!root.price) return false;

          const regular = root.price.regular.amount.value;
          const final = root.price.final.amount.value;
          return isOnSale(regular, final);
        },
      },
      display_price: {
        selectionSet: '{ price { final { amount { value } } } }',
        resolve: (root) => {
          return root.price?.final?.amount?.value || 0;
        },
      },
      display_currency: {
        selectionSet: '{ price { final { amount { currency } } } }',
        resolve: (root) => {
          return root.price?.final?.amount?.currency || 'USD';
        },
      },
      discount_percentage: {
        selectionSet: '{ price { regular { amount { value } } final { amount { value } } } }',
        resolve: (root) => {
          if (!root.price) return 0;

          const regular = root.price.regular.amount.value;
          const final = root.price.final.amount.value;
          return calculateDiscountPercentage(regular, final);
        },
      },
      in_stock: {
        selectionSet: '{ inStock }',
        resolve: (root) => {
          return root.inStock || false;
        },
      },
      secure_image: {
        selectionSet: '{ images(roles: ["small_image"]) { url label roles } }',
        resolve: (root) => {
          if (!root.images || root.images.length === 0) return null;
          const firstImage = root.images[0];
          return {
            ...firstImage,
            url: ensureHttpsUrl(firstImage.url),
          };
        },
      },
      secure_images: {
        selectionSet: '{ images { url label roles } }',
        resolve: (root) => {
          if (!root.images) return [];
          return root.images.map((image) => ({
            ...image,
            url: ensureHttpsUrl(image.url),
          }));
        },
      },
    },
  },
};
