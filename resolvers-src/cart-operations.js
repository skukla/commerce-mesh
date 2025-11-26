/**
 * Cart Operations Resolver
 * Provides semantic cart mutations following Citisignal patterns
 * Intelligently manages Adobe Commerce cart lifecycle
 */

// Cart ID management strategy (like your service selection logic)
const ensureCartId = async (context) => {
  // Check for existing cart ID from context/headers
  const existingCartId = context.headers['x-cart-id'] || context.cartId || context.request?.cartId;

  if (existingCartId) {
    // Validate cart still exists
    try {
      await context.CommerceGraphQL.Query.Commerce_cart({
        root: {},
        args: { cart_id: existingCartId },
        context,
        selectionSet: '{ id }',
      });
      return existingCartId;
    } catch (error) {
      context.logger.warn(`Cart invalid, creating new: ${error.message?.substring(0, 55)}`);
    }
  }

  // Create new cart
  const result = await context.CommerceGraphQL.Mutation.Commerce_createEmptyCart({
    root: {},
    args: {},
    context,
  });

  return result;
};

// Get cart with full details (following your query patterns)
const queryCartDetails = async (context, cartId) => {
  return await context.CommerceGraphQL.Query.Commerce_cart({
    root: {},
    args: { cart_id: cartId },
    context,
    selectionSet: `{
      id
      total_quantity
      items {
        id
        product {
          id
          sku
          name
          thumbnail { url }
          media_gallery { url label role }
        }
        quantity
        prices {
          row_total { value currency }
          price { value currency }
        }
        ... on ConfigurableCartItem {
          configurable_options {
            option_label
            value_label
            attribute_code
          }
        }
      }
      prices {
        grand_total { value currency }
        subtotal_excluding_tax { value currency }
      }
    }`,
  });
};

// Add product to cart (with service intelligence like your product queries)
const addProductToCart = async (context, input, cartId) => {
  // Build Adobe input (utility function will be injected)
  const adobeInput = buildAdobeCartInput(input, cartId); // eslint-disable-line no-undef

  // Determine mutation based on product type (like your service selection)
  const isConfigurable = input.selectedOptions && input.selectedOptions.length > 0;

  if (isConfigurable) {
    return await context.CommerceGraphQL.Mutation.Commerce_addConfigurableProductsToCart({
      root: {},
      args: { input: adobeInput },
      context,
      selectionSet: `{
        cart {
          id
          items {
            id
            product { sku }
          }
        }
      }`,
    });
  } else {
    return await context.CommerceGraphQL.Mutation.Commerce_addSimpleProductsToCart({
      root: {},
      args: { input: adobeInput },
      context,
      selectionSet: `{
        cart {
          id
          items {
            id
            product { sku }
          }
        }
      }`,
    });
  }
};

module.exports = {
  resolvers: {
    Query: {
      Citisignal_cart: {
        resolve: async (_root, _args, context, _info) => {
          try {
            const cartId = await ensureCartId(context);
            if (!cartId) return null;

            const adobeCart = await queryCartDetails(context, cartId);
            return transformCartToSemantic(adobeCart); // eslint-disable-line no-undef
          } catch (error) {
            context.logger.error(`Cart query error: ${error.message?.substring(0, 65)}`);
            return null; // Graceful degradation
          }
        },
      },
    },

    Mutation: {
      Citisignal_addToCart: {
        resolve: async (_root, { input }, context, _info) => {
          try {
            // Ensure we have a cart
            const cartId = await ensureCartId(context);

            // Get current cart to check for duplicates
            const currentCart = await queryCartDetails(context, cartId);

            // Check if item already exists in cart (same SKU + configuration)
            const existingItem = findExistingCartItem(currentCart, input); // eslint-disable-line no-undef

            if (existingItem) {
              // Item exists - update quantity instead of adding new item
              const updateInput = {
                cartItemId: existingItem.id,
                quantity: existingItem.quantity + (input.quantity || 1),
              };

              // Use the update mutation to increment quantity
              await context.CommerceGraphQL.Mutation.Commerce_updateCartItems({
                root: {},
                args: {
                  input: {
                    cart_id: cartId,
                    cart_items: [
                      {
                        cart_item_id: parseInt(existingItem.id),
                        quantity: updateInput.quantity,
                      },
                    ],
                  },
                },
                context,
                selectionSet: `{
                  cart {
                    id
                    items { id quantity }
                  }
                }`,
              });
            } else {
              // Item doesn't exist - add as new item
              await addProductToCart(context, input, cartId);
            }

            // Fetch updated cart details
            const updatedCart = await queryCartDetails(context, cartId);
            const semanticCart = transformCartToSemantic(updatedCart); // eslint-disable-line no-undef

            return {
              success: true,
              cart: semanticCart,
              errors: [],
            };
          } catch (error) {
            context.logger.error(`Add to cart error: ${error.message?.substring(0, 62)}`);
            return {
              success: false,
              cart: null,
              errors: [error.message],
            };
          }
        },
      },

      Citisignal_updateCartItem: {
        resolve: async (_root, { input }, context, _info) => {
          try {
            const cartId = await ensureCartId(context);

            // Build update input (utility function will be injected)
            const adobeInput = buildCartUpdateInput(input, cartId); // eslint-disable-line no-undef

            // Update cart item quantity
            await context.CommerceGraphQL.Mutation.Commerce_updateCartItems({
              root: {},
              args: { input: adobeInput },
              context,
              selectionSet: `{
                cart {
                  id
                  items { id quantity }
                }
              }`,
            });

            // Fetch updated cart
            const updatedCart = await queryCartDetails(context, cartId);

            return {
              success: true,
              cart: transformCartToSemantic(updatedCart), // eslint-disable-line no-undef
              errors: [],
            };
          } catch (error) {
            context.logger.error(`Update cart error: ${error.message?.substring(0, 62)}`);
            return {
              success: false,
              cart: null,
              errors: [error.message],
            };
          }
        },
      },

      Citisignal_removeFromCart: {
        resolve: async (_root, { cartItemId }, context, _info) => {
          try {
            const cartId = await ensureCartId(context);

            // Build remove input (utility function will be injected)
            const adobeInput = buildRemoveItemInput(cartItemId, cartId); // eslint-disable-line no-undef

            await context.CommerceGraphQL.Mutation.Commerce_removeItemFromCart({
              root: {},
              args: { input: adobeInput },
              context,
              selectionSet: `{
                cart {
                  id
                  items { id }
                }
              }`,
            });

            const updatedCart = await queryCartDetails(context, cartId);

            return {
              success: true,
              cart: transformCartToSemantic(updatedCart), // eslint-disable-line no-undef
              errors: [],
            };
          } catch (error) {
            context.logger.error(`Remove from cart error: ${error.message?.substring(0, 57)}`);
            return {
              success: false,
              cart: null,
              errors: [error.message],
            };
          }
        },
      },

      Citisignal_clearCart: {
        resolve: async (_root, _args, context, _info) => {
          try {
            // Create a new empty cart (effectively clearing the old one)
            const newCartId = await context.CommerceGraphQL.Mutation.Commerce_createEmptyCart({
              root: {},
              args: {},
              context,
            });

            // Return empty cart
            return {
              success: true,
              cart: {
                id: newCartId,
                itemCount: 0,
                totalValue: 0,
                totalDisplay: formatPrice(0),
                items: [],
                isEmpty: true,
              },
              errors: [],
            };
          } catch (error) {
            context.logger.error(`Clear cart error: ${error.message?.substring(0, 64)}`);
            return {
              success: false,
              cart: null,
              errors: [error.message],
            };
          }
        },
      },
    },
  },
};
