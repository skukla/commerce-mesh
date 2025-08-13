/**
 * Custom resolvers for Adobe API Mesh
 * Adds fields to existing Catalog Service types
 */

module.exports = {
  resolvers: {
    // Add fields to Catalog_ComplexProductView
    Catalog_ComplexProductView: {
      manufacturer: {
        selectionSet: '{ attributes { name value } }',
        resolve: (root, args, context, info) => {
          if (!root.attributes) return 'CitiSignal';
          
          const manufacturerAttr = root.attributes.find(attr => 
            attr.name === 'cs_manufacturer' || attr.name === 'manufacturer'
          );
          
          return manufacturerAttr?.value || 'CitiSignal';
        }
      },
      memory_options: {
        selectionSet: '{ options { title values { ... on Catalog_ProductViewOptionValueSwatch { title value } } } }',
        resolve: (root, args, context, info) => {
          if (!root.options) return [];
          
          const memoryOption = root.options.find(opt => opt.title === 'Memory');
          return memoryOption?.values?.map(v => v.title) || [];
        }
      },
      available_colors: {
        selectionSet: '{ options { title values { ... on Catalog_ProductViewOptionValueSwatch { title value } } } }',
        resolve: (root, args, context, info) => {
          if (!root.options) return [];
          
          const colorOption = root.options.find(opt => opt.title === 'Color');
          return colorOption?.values?.map(v => ({
            name: v.title,
            hex: v.value || '#000000'
          })) || [];
        }
      },
      is_on_sale: {
        selectionSet: '{ priceRange { minimum { regular { amount { value } } final { amount { value } } } } }',
        resolve: (root, args, context, info) => {
          if (!root.priceRange) return false;
          
          const regular = root.priceRange.minimum.regular.amount.value;
          const final = root.priceRange.minimum.final.amount.value;
          return final < regular;
        }
      }
    },
    
    // Add fields to Catalog_SimpleProductView  
    Catalog_SimpleProductView: {
      manufacturer: {
        selectionSet: '{ attributes { name value } }',
        resolve: (root, args, context, info) => {
          if (!root.attributes) return 'CitiSignal';
          
          const manufacturerAttr = root.attributes.find(attr => 
            attr.name === 'cs_manufacturer' || attr.name === 'manufacturer'
          );
          
          return manufacturerAttr?.value || 'CitiSignal';
        }
      },
      is_on_sale: {
        selectionSet: '{ price { regular { amount { value } } final { amount { value } } } }',
        resolve: (root, args, context, info) => {
          if (!root.price) return false;
          
          const regular = root.price.regular.amount.value;
          const final = root.price.final.amount.value;
          return final < regular;
        }
      }
    }
  }
};