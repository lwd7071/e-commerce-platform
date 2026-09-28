export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description: string;
  };
  servers: Array<{ url: string; description?: string }>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
  paths: Record<string, Record<string, unknown>>;
}

/**
 * Resolves the canonical URL for an OpenAPI operation given a server URL and path.
 * Guarantees no duplicate base path prefixes (e.g. avoids `/api/v1/api/v1/...`).
 */
export function resolveOperationUrl(serverUrl: string, path: string): string {
  const base = serverUrl.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (base && (cleanPath === base || cleanPath.startsWith(`${base}/`))) {
    return cleanPath;
  }
  return `${base}${cleanPath}`;
}

const successResponse = (description: string, schema = '#/components/schemas/SuccessEnvelope') => ({
  description,
  content: { 'application/json': { schema: { $ref: schema } } },
});

const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
});

const jsonRequest = (schema: Record<string, unknown>) => ({
  required: true,
  content: { 'application/json': { schema } },
});

export function generateOpenApiSpec(): OpenApiSpec {
  return {
    openapi: '3.1.0',
    info: {
      title: 'E-Commerce Platform API',
      version: '1.0.0',
      description: 'Production-ready E-Commerce REST API with RBAC, strictly audited routes and standard JSON envelopes.',
    },
    servers: [
      {
        url: '/api/v1',
        description: 'Current environment API v1 root',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Supabase JWT token issued upon user authentication',
        },
      },
      schemas: {
        ErrorEnvelope: {
          type: 'object',
          required: ['error', 'request_id'],
          properties: {
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: { type: 'string', example: 'RESOURCE_NOT_FOUND' },
                message: { type: 'string', example: 'Resource was not found' },
                details: { type: 'object', nullable: true },
              },
            },
            request_id: { type: 'string', example: 'req_01J8Y7...' },
          },
        },
        SuccessEnvelope: {
          type: 'object',
          required: ['data', 'request_id'],
          properties: {
            data: { type: 'object' },
            request_id: { type: 'string', example: 'req_01J8Y7...' },
          },
        },
        PaginatedEnvelope: {
          type: 'object',
          required: ['data', 'meta', 'request_id'],
          properties: {
            data: { type: 'array', items: { type: 'object' } },
            meta: {
              type: 'object',
              required: ['has_more', 'limit', 'next_cursor'],
              properties: {
                has_more: { type: 'boolean' },
                limit: { type: 'integer' },
                next_cursor: { type: 'string', nullable: true },
              },
            },
            request_id: { type: 'string', example: 'req_01J8Y7...' },
          },
        },
      },
    },
    paths: {
      '/products': {
        get: {
          summary: 'List public products',
          parameters: [
            ...['category_id', 'search', 'min_price', 'max_price', 'sort', 'limit', 'cursor'].map(name => ({
              name, in: 'query', required: false,
              schema: name === 'limit' ? { type: 'integer', minimum: 1, maximum: 100 }
                : name === 'sort' ? { type: 'string', enum: ['price_asc', 'price_desc', 'created_at_desc'] }
                  : { type: 'string' },
            })),
          ],
          responses: { '200': successResponse('Product page', '#/components/schemas/PaginatedEnvelope'), '422': errorResponse('Invalid query') },
        },
        post: {
          summary: 'Create product with variants',
          security: [{ BearerAuth: [] }],
          requestBody: jsonRequest({
            type: 'object', required: ['category_id', 'product_name', 'variants'],
            additionalProperties: false,
            properties: {
              category_id: { type: 'string', format: 'uuid' }, product_name: { type: 'string' }, description: { type: ['string', 'null'] },
              images: { type: 'array', items: { type: 'object', required: ['image_url'], additionalProperties: false, properties: { image_url: { type: 'string' }, sort_order: { type: 'integer', minimum: 0 } } } },
              variants: { type: 'array', minItems: 1, items: { type: 'object', required: ['variant_name', 'sku', 'price'], additionalProperties: false, properties: { variant_name: { type: 'string' }, variant_value: { type: ['string', 'null'] }, sku: { type: 'string' }, price: { type: 'string' }, stock_quantity: { type: 'integer', minimum: 0 } } } },
            },
          }),
          responses: { '201': successResponse('Product created'), '401': errorResponse('Authentication required'), '403': errorResponse('Seller role required'), '422': errorResponse('Invalid product') },
        },
      },
      '/products/{product_id}': {
        get: {
          summary: 'Get public product detail',
          parameters: [{ name: 'product_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': successResponse('Product detail'), '404': errorResponse('Product not found') },
        },
      },
      '/product-variants/{variant_id}/stock': {
        patch: {
          summary: 'Update owned product variant stock',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'variant_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', required: ['quantity'], additionalProperties: false, properties: { quantity: { type: 'integer', minimum: 0 } } }),
          responses: { '200': successResponse('Stock updated'), '403': errorResponse('Seller does not own variant'), '422': errorResponse('Invalid quantity') },
        },
      },
      '/health': {
        get: {
          summary: 'Platform Health Check',
          description: 'Checks status of platform and PostgreSQL database pool connectivity.',
          responses: {
            '200': {
              description: 'Platform and DB are operational',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            '503': {
              description: 'Database pool is degraded or unavailable',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
          },
        },
      },
      '/openapi.json': {
        get: {
          summary: 'Get the OpenAPI contract',
          responses: { '200': { description: 'OpenAPI 3.1 document', content: { 'application/json': { schema: { type: 'object', required: ['openapi', 'info', 'paths'] } } } } },
        },
      },
      '/addresses': {
        get: {
          summary: 'List Buyer Addresses',
          description: 'Retrieve all addresses for the authenticated buyer (canonical route, no /buyer prefix).',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'List of addresses',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            '401': {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
          },
        },
        post: {
          summary: 'Create Buyer Address',
          description: 'Create a new shipping address for the authenticated buyer.',
          security: [{ BearerAuth: [] }],
          requestBody: jsonRequest({
            type: 'object', required: ['recipient_name', 'phone', 'province', 'district', 'ward', 'detail_address'], additionalProperties: false,
            properties: {
              recipient_name: { type: 'string', minLength: 1 }, phone: { type: 'string', minLength: 1 },
              detail_address: { type: 'string', minLength: 1 }, province: { type: 'string', minLength: 1 },
              district: { type: 'string', minLength: 1 }, ward: { type: 'string', minLength: 1 }, is_default: { type: 'boolean' },
            },
          }),
          responses: {
            '201': {
              description: 'Address created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            '422': {
              description: 'Validation failed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
          },
        },
      },
      '/addresses/{address_id}': {
        get: {
          summary: 'Get Buyer Address',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'address_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': successResponse('Address detail'), '404': errorResponse('Address not found'), '501': errorResponse('Address detail is not wired in the current runtime') },
        },
        patch: {
          summary: 'Update Buyer Address',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'address_id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': {
              description: 'Address updated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
          },
        },
        delete: {
          summary: 'Delete Buyer Address',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'address_id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '204': { description: 'Address deleted; no response body' },
            '501': errorResponse('Address deletion is not available in the current runtime'),
          },
        },
      },
      '/addresses/{address_id}/default': {
        patch: {
          summary: 'Set Buyer Default Address',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'address_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': successResponse('Default address updated'), '404': errorResponse('Address not found'), '501': errorResponse('Address service is not wired in the current runtime') },
        },
      },
      '/cart': {
        get: {
          summary: 'Get Buyer Cart',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'Active shopping cart',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
          },
        },
      },
      '/cart/items': {
        post: {
          summary: 'Add Item to Cart',
          security: [{ BearerAuth: [] }],
          requestBody: jsonRequest({ type: 'object', required: ['variant_id', 'quantity'], additionalProperties: false, properties: { variant_id: { type: 'string', format: 'uuid' }, quantity: { type: 'integer', minimum: 1 } } }),
          responses: {
            '201': {
              description: 'Item added to cart',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
          },
        },
      },
      '/cart/items/{cart_item_id}': {
        patch: {
          summary: 'Update cart item quantity or selection',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'cart_item_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', minProperties: 1, additionalProperties: false, properties: { quantity: { type: 'integer', minimum: 1 }, is_selected: { type: 'boolean' } } }),
          responses: { '200': successResponse('Cart item updated'), '404': errorResponse('Cart item not found'), '409': errorResponse('Inventory insufficient'), '422': errorResponse('Invalid cart item') },
        },
        delete: {
          summary: 'Delete cart item', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'cart_item_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '204': { description: 'Cart item deleted; no response body' }, '404': errorResponse('Cart item not found') },
        },
      },
      '/cart/selected': {
        delete: { summary: 'Delete selected cart items', security: [{ BearerAuth: [] }], responses: { '204': { description: 'Selected cart items deleted; no response body' } } },
      },
      '/checkout': {
        post: {
          summary: 'Execute Checkout',
          description: 'Place an order atomically from selected cart items.',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 16, maxLength: 128 } }],
          requestBody: jsonRequest({ type: 'object', required: ['address_id', 'payment_method'], additionalProperties: false, properties: { address_id: { type: 'string', format: 'uuid' }, payment_method: { type: 'string', enum: ['COD', 'ONLINE'] }, vouchers: { type: 'array', items: { type: 'object', required: ['shop_id', 'code'], additionalProperties: false, properties: { shop_id: { type: 'string', format: 'uuid' }, code: { type: 'string', maxLength: 50 } } } } } }),
          responses: {
            '201': {
              description: 'Order created successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            '409': {
              description: 'Inventory insufficient or cart conflict',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
          },
        },
      },
      '/orders': {
        get: {
          summary: 'List Orders',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'List of orders (runtime currently returns a plain array in the success envelope)',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
          },
        },
        post: {
          summary: 'Create Order (Legacy Alias)',
          description: 'Alias route mapping to Checkout service.',
          security: [{ BearerAuth: [] }],
          responses: {
            '201': {
              description: 'Order created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
          },
        },
      },
      '/orders/{order_id}': {
        get: {
          summary: 'Get Order Detail',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'order_id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': {
              description: 'Order detail',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            '404': {
              description: 'Order not found or owned by another user',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
          },
        },
      },
      '/orders/{order_id}/cancel': {
        post: {
          summary: 'Cancel Order',
          description: 'Cancel an order with a mandatory reason (RB-LTT08).',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'order_id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': {
              description: 'Order cancelled',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            '422': {
              description: 'REASON_REQUIRED - cancellation reason is missing or blank',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
            '409': {
              description: 'ORDER_CANCELLATION_NOT_ALLOWED - state does not permit cancellation',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
          },
        },
      },
      '/orders/{order_id}/confirm': {
        post: {
          summary: 'Confirm Order',
          description: 'Seller or Admin confirms a pending order (transitions status to CONFIRMED).',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'order_id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          responses: {
            '200': {
              description: 'Order confirmed successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            '403': {
              description: 'Access forbidden for non-seller/admin or seller not owning shop',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
            '404': {
              description: 'Order not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
          },
        },
      },
      '/orders/{order_id}/transition': {
        post: {
          summary: 'Transition Order Status',
          description: 'Seller or Admin advances order status through state machine.',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'order_id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['to'],
                  properties: {
                    to: {
                      type: 'string',
                      enum: ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'COMPLETED', 'DELIVERY_FAILED', 'CANCELLED'],
                      example: 'PREPARING',
                    },
                    reason: { type: 'string', example: 'Stock ready for dispatch' },
                    exceptional_cancellation: { type: 'boolean' },
                    shipment_status: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Order status updated successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            '403': {
              description: 'Access forbidden',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
            '404': {
              description: 'Order not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
            '409': {
              description: 'Invalid order transition or conflict',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
          },
        },
      },
      '/orders/{order_id}/payments': {
        post: {
          summary: 'Retry Order Payment',
          description: 'Buyer initiates a payment attempt for an existing order.',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'order_id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    payment_method: { type: 'string', example: 'ONLINE' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Payment record created/retried successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            '403': {
              description: 'Access forbidden - buyer role required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
            '404': {
              description: 'Order not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
          },
        },
      },
      '/order-items/{order_item_id}/review': {
        post: {
          summary: 'Create Order Item Review',
          description: 'Submit a product review for a completed order item (api-conventions.md §7).',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'order_item_id',
              in: 'path',
              required: true,
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          requestBody: jsonRequest({ type: 'object', required: ['product_id', 'rating'], additionalProperties: false, properties: { product_id: { type: 'string', format: 'uuid' }, rating: { type: 'integer', minimum: 1, maximum: 5 }, content: { type: ['string', 'null'] }, comment: { type: ['string', 'null'] }, images: { type: 'array', items: { type: 'string' } } } }),
          responses: {
            '201': {
              description: 'Review created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            '409': {
              description: 'REVIEW_ALREADY_EXISTS - Item has already been reviewed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
            '422': {
              description: 'REVIEW_NOT_ELIGIBLE - Order not completed or not owned by user',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
            '501': errorResponse('Review service is not configured in runtime'),
          },
        },
      },
      '/reviews': {
        post: {
          summary: 'Create Order Item Review (alias)', security: [{ BearerAuth: [] }],
          requestBody: jsonRequest({ type: 'object', required: ['order_item_id', 'product_id', 'rating'], additionalProperties: false, properties: { order_item_id: { type: 'string', format: 'uuid' }, product_id: { type: 'string', format: 'uuid' }, rating: { type: 'integer', minimum: 1, maximum: 5 }, content: { type: ['string', 'null'] }, comment: { type: ['string', 'null'] }, images: { type: 'array', items: { type: 'string' } } } }),
          responses: { '201': successResponse('Review created'), '501': errorResponse('Review service is not configured') },
        },
      },
      '/vouchers': {
        get: {
          summary: 'List Active Vouchers',
          description: 'Retrieve active vouchers applicable to buyer or shop.',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'scope',
              in: 'query',
              required: false,
              schema: { type: 'string', enum: ['PLATFORM', 'SHOP'] },
            },
            {
              name: 'shop_id',
              in: 'query',
              required: false,
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'now',
              in: 'query',
              required: false,
              schema: { type: 'string', format: 'date-time' },
            },
          ],
          responses: {
            '200': {
              description: 'Active vouchers list',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            '401': {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
          },
        },
      },
      '/vouchers/applicable': {
        get: {
          summary: 'List applicable vouchers (alias)', security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'scope', in: 'query', required: false, schema: { type: 'string', enum: ['PLATFORM', 'SHOP'] } },
            { name: 'shop_id', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
            { name: 'now', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          ],
          responses: { '200': successResponse('Applicable voucher list'), '401': errorResponse('Authentication required') },
        },
      },
      '/vouchers/evaluate': {
        post: {
          summary: 'Evaluate & Preview Voucher',
          description: 'Preview voucher discount amount for given subtotal and context.',
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['code', 'order_subtotal'],
                  properties: {
                    code: { type: 'string', example: 'DISCOUNT10' },
                    order_subtotal: { type: 'string', example: '100000' },
                    shop_id: { type: 'string', format: 'uuid' },
                    now: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Voucher preview result',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            '422': {
              description: 'Voucher not applicable or validation failed',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
          },
        },
      },
      '/vouchers/preview': {
        post: {
          summary: 'Evaluate voucher (alias)', security: [{ BearerAuth: [] }],
          requestBody: jsonRequest({ type: 'object', required: ['code', 'order_subtotal'], additionalProperties: false, properties: { code: { type: 'string' }, order_subtotal: { type: 'string' }, shop_id: { type: 'string', format: 'uuid' }, now: { type: 'string', format: 'date-time' } } }),
          responses: { '200': successResponse('Voucher evaluation result'), '422': errorResponse('Voucher is not applicable') },
        },
      },
      '/notifications': {
        get: {
          summary: 'List Buyer Notifications',
          description: 'Retrieve recipient notifications with optional read status filter.',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'is_read',
              in: 'query',
              required: false,
              schema: { type: 'boolean' },
            },
          ],
          responses: {
            '200': {
              description: 'List of notifications',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            '401': {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
            '501': errorResponse('Notification service is not configured in runtime'),
          },
        },
      },
      '/notifications/{notification_id}/read': {
        patch: {
          summary: 'Mark Notification As Read',
          description: 'Mark specific notification as read (RB-LTT07).',
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: 'notification_id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
            },
          ],
          responses: {
            '200': {
              description: 'Notification marked as read',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            '401': {
              description: 'Authentication required',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
            '404': {
              description: 'Notification not found',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
          },
        },
      },
      '/notifications/{notification_id}': {
        get: {
          summary: 'Get Buyer Notification', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'notification_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': successResponse('Notification detail'), '404': errorResponse('Notification not found'), '501': errorResponse('Notification service is not wired in the current runtime') },
        },
        patch: {
          summary: 'Mark Buyer Notification As Read (alias)', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'notification_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': successResponse('Notification updated'), '404': errorResponse('Notification not found'), '501': errorResponse('Notification service is not wired in the current runtime') },
        },
      },
      '/admin/users/{id}/lock': {
        post: {
          summary: 'Lock user account', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', required: ['reason'], additionalProperties: false, properties: { reason: { type: 'string', minLength: 1 } } }),
          responses: { '200': successResponse('User locked'), '403': errorResponse('Admin role required'), '422': errorResponse('Reason required'), '501': errorResponse('Moderation service is not wired') },
        },
      },
      '/admin/users/{id}/unlock': {
        post: {
          summary: 'Unlock user account', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', required: ['reason'], additionalProperties: false, properties: { reason: { type: 'string', minLength: 1 } } }),
          responses: { '200': successResponse('User unlocked'), '403': errorResponse('Admin role required'), '422': errorResponse('Reason required'), '501': errorResponse('Moderation service is not wired') },
        },
      },
    },
  };
}
