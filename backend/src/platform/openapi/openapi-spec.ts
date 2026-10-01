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
        NotificationDTO: {
          type: 'object',
          required: ['notificationId', 'recipientId', 'type', 'title', 'content', 'isRead', 'createdAt', 'readAt'],
          properties: {
            notificationId: { type: 'string', format: 'uuid' },
            recipientId: { type: 'string', format: 'uuid' },
            type: { type: 'string', enum: ['ORDER', 'PAYMENT', 'SHIPPING', 'VIOLATION', 'SYSTEM'] },
            title: { type: 'string', maxLength: 255 },
            content: { type: 'string' },
            isRead: { type: 'boolean' },
            createdAt: { type: 'string', format: 'date-time' },
            readAt: { type: ['string', 'null'], format: 'date-time' },
          },
        },
        NotificationListEnvelope: {
          type: 'object', required: ['data', 'request_id'],
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/NotificationDTO' } },
            request_id: { type: 'string' },
          },
        },
        NotificationEnvelope: {
          type: 'object', required: ['data', 'request_id'],
          properties: {
            data: { $ref: '#/components/schemas/NotificationDTO' },
            request_id: { type: 'string' },
          },
        },
        OrderReadDTO: {
          type: 'object', required: ['order_id', 'buyer_id', 'shop_id', 'shop_name', 'status', 'subtotal', 'discount_amount', 'shipping_fee', 'total_amount', 'cancel_reason', 'created_at', 'updated_at', 'items', 'status_history'],
          properties: {
            order_id: { type: 'string', format: 'uuid' }, buyer_id: { type: 'string', format: 'uuid' }, shop_id: { type: 'string', format: 'uuid' }, shop_name: { type: 'string' },
            status: { type: 'string', enum: ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'COMPLETED', 'CANCELLED', 'DELIVERY_FAILED'] },
            subtotal: { type: 'string', pattern: '^\\d+\\.\\d{2}$' }, discount_amount: { type: 'string', pattern: '^\\d+\\.\\d{2}$' }, shipping_fee: { type: 'string', pattern: '^\\d+\\.\\d{2}$' }, total_amount: { type: 'string', pattern: '^\\d+\\.\\d{2}$' },
            cancel_reason: { type: ['string', 'null'] }, created_at: { type: 'string', format: 'date-time' }, updated_at: { type: 'string', format: 'date-time' },
            items: { type: 'array', items: { type: 'object', required: ['order_item_id', 'product_id', 'variant_id', 'product_name', 'variant_name', 'unit_price', 'quantity', 'line_total', 'image_url'], properties: {
              order_item_id: { type: 'string', format: 'uuid' }, product_id: { type: 'string', format: 'uuid' }, variant_id: { type: 'string', format: 'uuid' }, product_name: { type: 'string' }, variant_name: { type: 'string' }, unit_price: { type: 'string' }, quantity: { type: 'integer', minimum: 1 }, line_total: { type: 'string' }, image_url: { type: ['string', 'null'], format: 'uri' },
            } } },
            status_history: { type: 'array', items: { type: 'object', required: ['history_id', 'old_status', 'new_status', 'changed_by', 'reason', 'changed_at'], properties: {
              history_id: { type: 'string', format: 'uuid' }, old_status: { type: ['string', 'null'] }, new_status: { type: 'string' },
              changed_by: { type: ['string', 'null'], format: 'uuid' }, reason: { type: ['string', 'null'] }, changed_at: { type: 'string', format: 'date-time' },
            } } },
          },
        },
        OrderListSuccessEnvelope: { type: 'object', required: ['data', 'request_id'], properties: { data: { type: 'array', items: { $ref: '#/components/schemas/OrderReadDTO' } }, request_id: { type: 'string' } } },
        OrderDetailSuccessEnvelope: { type: 'object', required: ['data', 'request_id'], properties: { data: { $ref: '#/components/schemas/OrderReadDTO' }, request_id: { type: 'string' } } },
        CategoryDTO: { type: 'object', required: ['category_id', 'parent_category_id', 'category_name', 'description'], properties: { category_id: { type: 'string', format: 'uuid' }, parent_category_id: { type: ['string', 'null'], format: 'uuid' }, category_name: { type: 'string' }, description: { type: ['string', 'null'] } } },
        CategoryListSuccessEnvelope: { type: 'object', required: ['data', 'request_id'], properties: { data: { type: 'array', items: { $ref: '#/components/schemas/CategoryDTO' } }, request_id: { type: 'string' } } },
        ProfileDTO: { type: 'object', required: ['user_id', 'full_name', 'phone', 'avatar_url', 'updated_at'], properties: { user_id: { type: 'string', format: 'uuid' }, full_name: { type: 'string', nullable: true }, phone: { type: ['string', 'null'] }, avatar_url: { type: ['string', 'null'] }, updated_at: { type: 'string', format: 'date-time' } } },
        ProfileSuccessEnvelope: { type: 'object', required: ['data', 'request_id'], properties: { data: { $ref: '#/components/schemas/ProfileDTO' }, request_id: { type: 'string' } } },
        AddressDTO: { type: 'object', required: ['addressId', 'userId', 'recipientName', 'phone', 'province', 'district', 'ward', 'detailAddress', 'isDefault', 'createdAt', 'updatedAt'], properties: { addressId: { type: 'string', format: 'uuid' }, userId: { type: 'string', format: 'uuid' }, recipientName: { type: 'string' }, phone: { type: 'string' }, province: { type: 'string' }, district: { type: 'string' }, ward: { type: 'string' }, detailAddress: { type: 'string' }, isDefault: { type: 'boolean' }, createdAt: { type: 'string', format: 'date-time' }, updatedAt: { type: 'string', format: 'date-time' } } },
        AddressSuccessEnvelope: { type: 'object', required: ['data', 'request_id'], properties: { data: { $ref: '#/components/schemas/AddressDTO' }, request_id: { type: 'string' } } },
        AddressListSuccessEnvelope: { type: 'object', required: ['data', 'request_id'], properties: { data: { type: 'array', items: { $ref: '#/components/schemas/AddressDTO' } }, request_id: { type: 'string' } } },
        CartItemReadDTO: { type: 'object', required: ['cart_item_id', 'variant_id', 'product_id', 'product_name', 'variant_name', 'price', 'stock_quantity', 'shop_id', 'shop_name', 'image_url', 'product_status', 'variant_status', 'shop_status', 'is_available', 'quantity', 'is_selected'], properties: {
          cart_item_id: { type: 'string', format: 'uuid' }, variant_id: { type: 'string', format: 'uuid' }, product_id: { type: 'string', format: 'uuid' }, product_name: { type: 'string' }, variant_name: { type: 'string' }, price: { type: 'string', pattern: '^\\d+\\.\\d{2}$' }, stock_quantity: { type: 'integer', minimum: 0 }, shop_id: { type: 'string', format: 'uuid' }, shop_name: { type: 'string' }, image_url: { type: ['string', 'null'], format: 'uri' }, product_status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] }, variant_status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] }, shop_status: { type: 'string' }, is_available: { type: 'boolean' }, quantity: { type: 'integer', minimum: 1 }, is_selected: { type: 'boolean' },
        } },
        CartSuccessEnvelope: { type: 'object', required: ['data', 'request_id'], properties: { data: { type: 'object', required: ['cart_id', 'buyer_id', 'items'], properties: { cart_id: { type: ['string', 'null'], format: 'uuid' }, buyer_id: { type: 'string', format: 'uuid' }, items: { type: 'array', items: { $ref: '#/components/schemas/CartItemReadDTO' } } } }, request_id: { type: 'string' } } },
      },
    },
    paths: {
      '/auth/me': {
        get: {
          summary: 'Get current authenticated user profile context',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': successResponse('Authenticated user context'),
            '401': errorResponse('Authentication required'),
          },
        },
      },
      '/auth/onboarding': {
        post: {
          summary: 'Complete initial onboarding for Buyer or Seller',
          security: [{ BearerAuth: [] }],
          requestBody: jsonRequest({ type: 'object', required: ['full_name', 'requested_role', 'shop_name'], additionalProperties: false, properties: { full_name: { type: 'string', minLength: 2, maxLength: 150 }, requested_role: { type: 'string', enum: ['BUYER', 'SELLER'] }, shop_name: { type: ['string', 'null'], minLength: 2, maxLength: 150 } } }),
          responses: {
            '200': successResponse('Onboarding completed'),
            '401': errorResponse('Authentication required'),
            '403': errorResponse('Role not permitted'),
            '409': errorResponse('Onboarding conflicts with existing profile/shop'),
            '422': errorResponse('Invalid onboarding payload'),
          },
        },
      },
      '/categories': {
        get: {
          summary: 'List active public categories',
          responses: { '200': successResponse('Active categories', '#/components/schemas/CategoryListSuccessEnvelope'), '503': errorResponse('Category service unavailable') },
        },
      },
      '/profile': {
        get: {
          summary: 'Get current user profile',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': successResponse('User profile', '#/components/schemas/ProfileSuccessEnvelope'),
            '401': errorResponse('Authentication required'),
            '501': errorResponse('Profile service not available'),
          },
        },
        patch: {
          summary: 'Update current user profile',
          security: [{ BearerAuth: [] }],
          requestBody: jsonRequest({
            type: 'object',
            additionalProperties: false,
            properties: {
              full_name: { type: 'string', minLength: 2, maxLength: 150 },
              phone: { type: 'string', nullable: true },
            },
          }),
          responses: {
            '200': successResponse('Profile updated', '#/components/schemas/ProfileSuccessEnvelope'),
            '401': errorResponse('Authentication required'),
            '422': errorResponse('Validation failed'),
            '501': errorResponse('Profile service not available'),
          },
        },
      },
      '/profile/avatar': {
        patch: {
          summary: 'Attach a finalized avatar upload to the current profile',
          security: [{ BearerAuth: [] }],
          requestBody: jsonRequest({
            type: 'object', required: ['media_id'], additionalProperties: false,
            properties: { media_id: { type: 'string', format: 'uuid' } },
          }),
          responses: {
            '200': successResponse('Profile avatar updated', '#/components/schemas/ProfileSuccessEnvelope'),
            '401': errorResponse('Authentication required'),
            '403': errorResponse('Media must be finalized and owned by the current user'),
            '404': errorResponse('Profile not found'),
            '422': errorResponse('Invalid media ID'),
          },
        },
      },
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
              product_id: { type: 'string', format: 'uuid' }, category_id: { type: 'string', format: 'uuid' }, product_name: { type: 'string' }, description: { type: ['string', 'null'] },
              images: { type: 'array', items: { type: 'object', required: ['image_url', 'media_id'], additionalProperties: false, properties: { image_url: { type: 'string', format: 'uri' }, media_id: { type: 'string', format: 'uuid' }, sort_order: { type: 'integer', minimum: 0 } } } },
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
      '/products/{product_id}/reviews': {
        get: {
          summary: 'List public product reviews with aggregate rating',
          parameters: [
            { name: 'product_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
            { name: 'cursor', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: {
            '200': successResponse('Public product reviews'),
            '501': errorResponse('Review service not available'),
          },
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
      '/health/readiness': {
        get: {
          summary: 'Platform Capability and Runtime Readiness',
          description: 'Returns commit/version, DB/Auth/Storage connectivity, and capability state matching the frontend release manifest.',
          responses: {
            '200': {
              description: 'Platform, dependencies and capabilities are operational and ready for promotion',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
            '503': {
              description: 'One or more critical dependencies are degraded or unhealthy',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
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
                  schema: { $ref: '#/components/schemas/AddressListSuccessEnvelope' },
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
            type: 'object', required: ['recipientName', 'phone', 'province', 'district', 'ward', 'detailAddress'], additionalProperties: false,
            properties: { recipientName: { type: 'string', minLength: 1 }, phone: { type: 'string', minLength: 1 }, detailAddress: { type: 'string', minLength: 1 }, province: { type: 'string', minLength: 1 }, district: { type: 'string', minLength: 1 }, ward: { type: 'string', minLength: 1 }, isDefault: { type: 'boolean' } },
          }),
          responses: {
            '201': {
              description: 'Address created',
              content: {
                'application/json': {
              schema: { $ref: '#/components/schemas/AddressSuccessEnvelope' },
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
          responses: { '200': successResponse('Address detail', '#/components/schemas/AddressSuccessEnvelope'), '404': errorResponse('Address not found') },
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
          requestBody: jsonRequest({ type: 'object', minProperties: 1, additionalProperties: false, properties: { recipientName: { type: 'string', minLength: 2, maxLength: 150 }, phone: { type: 'string' }, province: { type: 'string' }, district: { type: 'string' }, ward: { type: 'string' }, detailAddress: { type: 'string' }, isDefault: { type: 'boolean' } } }),
          responses: {
            '200': {
              description: 'Address updated',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/AddressSuccessEnvelope' },
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
          },
        },
      },
      '/addresses/{address_id}/default': {
        patch: {
          summary: 'Set Buyer Default Address',
          security: [{ BearerAuth: [] }],
          parameters: [{ name: 'address_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': successResponse('Default address updated'), '404': errorResponse('Address not found') },
        },
      },
      '/cart': {
        get: {
          summary: 'Get Buyer Cart',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'Cart with current catalog and availability fields',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CartSuccessEnvelope' },
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
          parameters: [
            { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'COMPLETED', 'CANCELLED', 'DELIVERY_FAILED'] } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100 } },
            { name: 'cursor', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: {
            '200': successResponse('Paginated Orders owned by the authenticated Buyer/Seller or visible to Admin', '#/components/schemas/PaginatedEnvelope'),
            '422': errorResponse('Invalid status filter or unsupported query field'),
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
              description: 'Order detail with item snapshots',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/OrderDetailSuccessEnvelope' } } },
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
          requestBody: {
            required: false,
            content: {
              'application/json': {
                schema: { type: 'object', properties: { reason: { type: 'string', example: 'Admin intervention after support review' } } },
              },
            },
          },
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
      '/orders/{order_id}/confirm-received': {
        post: {
          summary: 'Confirm Order Receipt',
          description: 'Buyer confirms receipt of their SHIPPING order, moving it to COMPLETED. Admin may also perform this moderation action.',
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
                schema: { type: 'object', properties: { reason: { type: 'string', example: 'Admin intervention after support review' } } },
              },
            },
          },
          responses: {
            '200': {
              description: 'Order receipt confirmed and order completed',
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
            '403': {
              description: 'Access forbidden for non-buyer/admin',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
            '404': {
              description: 'Order not found or owned by another buyer',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ErrorEnvelope' },
                },
              },
            },
            '409': {
              description: 'Order is not in SHIPPING state',
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
            '200': successResponse('List of notifications', '#/components/schemas/NotificationListEnvelope'),
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
            '200': successResponse('Notification marked as read', '#/components/schemas/NotificationEnvelope'),
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
          responses: { '200': successResponse('Notification detail', '#/components/schemas/NotificationEnvelope'), '404': errorResponse('Notification not found') },
        },
        patch: {
          summary: 'Mark Buyer Notification As Read (alias)', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'notification_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': successResponse('Notification updated', '#/components/schemas/NotificationEnvelope'), '404': errorResponse('Notification not found') },
        },
      },
      '/admin/users': {
        get: {
          summary: 'List users for moderation', security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'role', in: 'query', required: false, schema: { type: 'string', enum: ['BUYER', 'SELLER', 'ADMIN'] } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['ACTIVE', 'LOCKED'] } },
            { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '200': successResponse('Users list retrieved'), '403': errorResponse('Admin role required') },
        },
      },
      '/admin/stats': {
        get: { summary: 'Read Admin dashboard KPIs', security: [{ BearerAuth: [] }], responses: { '200': successResponse('Dashboard statistics'), '403': errorResponse('Admin role required') } },
      },
      '/admin/reports': {
        get: {
          summary: 'Read Admin operational report for an inclusive Ho Chi Minh date range', security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'from', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
            { name: 'to', in: 'query', required: true, schema: { type: 'string', format: 'date' } },
          ],
          responses: { '200': successResponse('Daily GMV, order statuses, top shops, products and moderation actions'), '403': errorResponse('Admin role required'), '422': errorResponse('Invalid date range') },
        },
      },
      '/admin/orders': {
        get: {
          summary: 'List all orders for Admin', security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'COMPLETED', 'CANCELLED', 'DELIVERY_FAILED'] } },
            { name: 'search', in: 'query', schema: { type: 'string' } }, { name: 'shop_id', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'buyer_id', in: 'query', schema: { type: 'string', format: 'uuid' } }, { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
            { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } },
            { name: 'cursor', in: 'query', schema: { type: 'string' } },
          ],
          responses: { '200': successResponse('Admin order page', '#/components/schemas/PaginatedEnvelope'), '403': errorResponse('Admin role required'), '422': errorResponse('Invalid filter or cursor') },
        },
      },
      '/admin/orders/{id}': {
        get: {
          summary: 'Read an order, payment attempts, shipment and status history', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': successResponse('Admin order detail'), '403': errorResponse('Admin role required'), '404': errorResponse('Order not found') },
        },
      },
      '/admin/orders/{id}/transition': {
        patch: {
          summary: 'Intervene in an order through the state machine', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', required: ['to', 'reason'], properties: { to: { type: 'string', enum: ['PENDING_CONFIRMATION', 'CONFIRMED', 'PREPARING', 'SHIPPING', 'COMPLETED', 'DELIVERY_FAILED', 'CANCELLED'] }, reason: { type: 'string', minLength: 1 }, exceptional_cancellation: { type: 'boolean' }, shipment_status: { type: 'string' } } }),
          responses: { '200': successResponse('Order transitioned'), '403': errorResponse('Admin role required'), '404': errorResponse('Order not found'), '409': errorResponse('Invalid order transition'), '422': errorResponse('Reason required') },
        },
      },
      '/admin/audit-logs': {
        get: {
          summary: 'List Admin audit log entries', security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'action', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'target_type', in: 'query', required: false, schema: { type: 'string', enum: ['USER', 'SHOP', 'PRODUCT', 'REVIEW', 'ORDER', 'CATEGORY', 'VOUCHER', 'CAMPAIGN'] } },
            { name: 'actor', in: 'query', required: false, schema: { type: 'string', format: 'uuid' } },
            { name: 'from', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
            { name: 'to', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
            { name: 'cursor', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '200': successResponse('Paginated audit log entries', '#/components/schemas/PaginatedEnvelope'), '403': errorResponse('Admin role required'), '422': errorResponse('Invalid query') },
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
      '/admin/shops': {
        get: {
          summary: 'List shops for moderation', security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['PENDING', 'ACTIVE', 'LOCKED', 'SUSPENDED'] } },
            { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '200': successResponse('Shops list retrieved'), '403': errorResponse('Admin role required') },
        },
      },
      '/admin/shops/{id}/approve': {
        post: {
          summary: 'Approve pending shop', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', properties: { reason: { type: 'string' } } }),
          responses: { '200': successResponse('Shop approved'), '403': errorResponse('Admin role required'), '404': errorResponse('Shop not found'), '409': errorResponse('Shop already active') },
        },
      },
      '/admin/shops/{id}/lock': {
        post: {
          summary: 'Lock shop', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', required: ['reason'], additionalProperties: false, properties: { reason: { type: 'string', minLength: 1 } } }),
          responses: { '200': successResponse('Shop locked'), '403': errorResponse('Admin role required'), '404': errorResponse('Shop not found'), '422': errorResponse('Reason required') },
        },
      },
      '/admin/shops/{id}/unlock': {
        post: {
          summary: 'Unlock shop', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', properties: { reason: { type: 'string' } } }),
          responses: { '200': successResponse('Shop unlocked'), '403': errorResponse('Admin role required'), '404': errorResponse('Shop not found'), '409': errorResponse('Shop already active') },
        },
      },
      '/admin/products': {
        get: {
          summary: 'List all products for Admin moderation', security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'HIDDEN'] } },
            { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '200': successResponse('Products retrieved'), '403': errorResponse('Admin role required') },
        },
      },
      '/admin/vouchers': {
        get: { summary: 'List platform and shop vouchers for Admin review', security: [{ BearerAuth: [] }], responses: { '200': successResponse('Voucher list'), '403': errorResponse('Admin role required') } },
        post: {
          summary: 'Create a PLATFORM voucher', security: [{ BearerAuth: [] }],
          requestBody: jsonRequest({ type: 'object', required: ['code', 'voucher_name', 'discount_type', 'discount_value', 'max_discount', 'min_order_value', 'quantity', 'start_at', 'end_at', 'reason'], additionalProperties: false, properties: {
            code: { type: 'string', maxLength: 50 }, voucher_name: { type: 'string', maxLength: 150 }, discount_type: { type: 'string', enum: ['PERCENT', 'FIXED'] }, discount_value: { type: 'string' }, max_discount: { type: ['string', 'null'] }, min_order_value: { type: 'string' }, quantity: { type: 'integer', minimum: 0 }, start_at: { type: 'string', format: 'date-time' }, end_at: { type: 'string', format: 'date-time' }, reason: { type: 'string', minLength: 1 },
          } }),
          responses: { '201': successResponse('Platform voucher created'), '403': errorResponse('Admin role required'), '422': errorResponse('Invalid voucher or reason') },
        },
      },
      '/admin/notification-campaigns': {
        post: {
          summary: 'Create an idempotent Admin notification campaign and snapshot recipients', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 1, maxLength: 100 } }],
          requestBody: jsonRequest({ type: 'object', required: ['audience_role', 'title', 'content', 'reason'], properties: { audience_role: { type: 'string', enum: ['BUYER', 'SELLER'] }, title: { type: 'string', maxLength: 200 }, content: { type: 'string' }, reason: { type: 'string', minLength: 1 } } }),
          responses: { '201': successResponse('Campaign created'), '403': errorResponse('Admin role required'), '409': errorResponse('Idempotency key was reused'), '422': errorResponse('Invalid campaign') },
        },
      },
      '/admin/notification-campaigns/preview': {
        get: {
          summary: 'Preview active recipient count for a campaign audience', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'audience_role', in: 'query', required: true, schema: { type: 'string', enum: ['BUYER', 'SELLER'] } }],
          responses: { '200': successResponse('Audience count preview'), '403': errorResponse('Admin role required'), '422': errorResponse('Invalid audience') },
        },
      },
      '/admin/notification-campaigns/{id}': {
        get: {
          summary: 'Read notification campaign delivery progress', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': successResponse('Campaign progress'), '403': errorResponse('Admin role required'), '404': errorResponse('Campaign not found') },
        },
      },
      '/admin/vouchers/{id}': {
        patch: {
          summary: 'Update an unused PLATFORM voucher', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', required: ['reason'], properties: { code: { type: 'string' }, voucher_name: { type: 'string' }, discount_type: { type: 'string', enum: ['PERCENT', 'FIXED'] }, discount_value: { type: 'string' }, max_discount: { type: ['string', 'null'] }, min_order_value: { type: 'string' }, quantity: { type: 'integer' }, start_at: { type: 'string', format: 'date-time' }, end_at: { type: 'string', format: 'date-time' }, reason: { type: 'string', minLength: 1 } } }),
          responses: { '200': successResponse('Platform voucher updated'), '403': errorResponse('Admin role required'), '404': errorResponse('Voucher not found'), '409': errorResponse('Voucher already used'), '422': errorResponse('Invalid voucher or reason') },
        },
      },
      '/admin/vouchers/{id}/status': {
        patch: {
          summary: 'Activate or deactivate a PLATFORM voucher', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', required: ['status', 'reason'], properties: { status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] }, reason: { type: 'string', minLength: 1 } } }),
          responses: { '200': successResponse('Platform voucher status updated'), '403': errorResponse('Admin role required'), '404': errorResponse('Voucher not found'), '422': errorResponse('Invalid status or reason') },
        },
      },
      '/admin/products/{id}/moderate': {
        patch: {
          summary: 'Hide or restore a product', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', required: ['status', 'reason'], additionalProperties: false, properties: { status: { type: 'string', enum: ['ACTIVE', 'HIDDEN'] }, reason: { type: 'string', minLength: 1 } } }),
          responses: { '200': successResponse('Product moderated'), '403': errorResponse('Admin role required'), '404': errorResponse('Product not found'), '409': errorResponse('Invalid moderation transition'), '422': errorResponse('Reason required') },
        },
      },
      '/admin/reviews': {
        get: {
          summary: 'List all reviews for Admin moderation', security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['VISIBLE', 'HIDDEN'] } },
            { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '200': successResponse('Reviews retrieved'), '403': errorResponse('Admin role required') },
        },
      },
      '/admin/reviews/{id}/moderate': {
        patch: {
          summary: 'Hide or restore a review', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', required: ['status', 'reason'], additionalProperties: false, properties: { status: { type: 'string', enum: ['VISIBLE', 'HIDDEN'] }, reason: { type: 'string', minLength: 1 } } }),
          responses: { '200': successResponse('Review moderated'), '403': errorResponse('Admin role required'), '404': errorResponse('Review not found'), '409': errorResponse('Invalid moderation transition'), '422': errorResponse('Reason required') },
        },
      },
      '/seller/products': {
        get: {
          summary: 'List products belonging to seller shop', security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'search', in: 'query', required: false, schema: { type: 'string' } },
            { name: 'status', in: 'query', required: false, schema: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'HIDDEN'] } },
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer' } },
            { name: 'cursor', in: 'query', required: false, schema: { type: 'string' } },
          ],
          responses: { '200': successResponse('Seller product page', '#/components/schemas/PaginatedEnvelope'), '403': errorResponse('Seller role and active shop required') },
        },
      },
      '/seller/products/{id}': {
        get: {
          summary: 'Read product details, including inactive variants, belonging to the authenticated Seller shop', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '200': successResponse('Seller product detail'), '403': errorResponse('Seller role and active shop required'), '404': errorResponse('Product not found') },
        },
        patch: {
          summary: 'Update editable details and existing variant prices/SKUs for a Seller product', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', additionalProperties: false, minProperties: 1, properties: {
            product_name: { type: 'string', minLength: 2, maxLength: 200 }, description: { type: ['string', 'null'] }, category_id: { type: 'string', format: 'uuid' },
            variants: { type: 'array', minItems: 1, items: { type: 'object', required: ['variant_name', 'sku', 'price'], properties: { variant_id: { type: 'string', format: 'uuid' }, variant_name: { type: 'string', maxLength: 100 }, variant_value: { type: ['string', 'null'], maxLength: 150 }, sku: { type: 'string', maxLength: 100 }, price: { type: 'string' } } } },
            images: { type: 'array', items: { type: 'object', required: ['image_url'], properties: { image_id: { type: 'string', format: 'uuid' }, media_id: { type: 'string', format: 'uuid' }, image_url: { type: 'string' }, sort_order: { type: 'integer', minimum: 0 } } } },
          } }),
          responses: { '200': successResponse('Seller product updated'), '403': errorResponse('Seller role and active shop required'), '404': errorResponse('Product or variant not found'), '409': errorResponse('SKU already used in Seller shop'), '422': errorResponse('Invalid product fields') },
        },
      },
      '/seller/shop': {
        get: {
          summary: 'Read the authenticated seller shop profile', security: [{ BearerAuth: [] }],
          responses: { '200': successResponse('Seller shop profile'), '403': errorResponse('Seller role required'), '404': errorResponse('Seller shop not found') },
        },
        patch: {
          summary: 'Update the authenticated seller shop profile', security: [{ BearerAuth: [] }],
          requestBody: jsonRequest({ type: 'object', minProperties: 1, properties: {
            shop_name: { type: 'string', minLength: 2, maxLength: 150 }, description: { type: ['string', 'null'] },
            pickup_address: { type: ['string', 'null'], maxLength: 255 }, contact_phone: { type: ['string', 'null'], maxLength: 20 },
          } }),
          responses: { '200': successResponse('Seller shop profile updated'), '403': errorResponse('Shop profile is read-only'), '404': errorResponse('Seller shop not found'), '422': errorResponse('Invalid shop profile') },
        },
      },
      '/seller/shop/logo': {
        patch: {
          summary: 'Update the authenticated seller shop logo using a finalized media upload',
          security: [{ BearerAuth: [] }],
          requestBody: jsonRequest({
            type: 'object',
            required: ['media_id'],
            properties: {
              media_id: { type: 'string', format: 'uuid' },
            },
          }),
          responses: {
            '200': successResponse('Shop logo updated'),
            '403': errorResponse('Seller role required or shop profile is read-only'),
            '404': errorResponse('Seller shop not found'),
            '422': errorResponse('Invalid media_id or media upload not finalized for shop logo'),
          },
        },
      },

      '/seller/kpi': {
        get: {
          summary: 'Read KPI data for the authenticated seller shop', security: [{ BearerAuth: [] }],
          responses: { '200': successResponse('Seller KPI'), '403': errorResponse('Seller role and active shop required'), '404': errorResponse('Seller shop not found') },
        },
      },
      '/seller/vouchers': {
        get: { summary: 'List vouchers belonging to the authenticated Seller shop', security: [{ BearerAuth: [] }], responses: { '200': successResponse('Shop vouchers'), '403': errorResponse('Active Seller shop required') } },
        post: {
          summary: 'Create a voucher for the authenticated Seller shop', security: [{ BearerAuth: [] }],
          requestBody: jsonRequest({ type: 'object', additionalProperties: false, required: ['code', 'voucher_name', 'discount_type', 'discount_value', 'max_discount', 'min_order_value', 'quantity', 'start_at', 'end_at'], properties: {
            code: { type: 'string', maxLength: 50 }, voucher_name: { type: 'string', maxLength: 150 }, discount_type: { type: 'string', enum: ['PERCENT', 'FIXED'] },
            discount_value: { type: 'string', pattern: '^\\d+(?:\\.\\d{1,2})?$' }, max_discount: { type: ['string', 'null'] }, min_order_value: { type: 'string' },
            quantity: { type: 'integer', minimum: 0 }, start_at: { type: 'string', format: 'date-time' }, end_at: { type: 'string', format: 'date-time' },
          } }),
          responses: { '201': successResponse('Shop voucher created'), '403': errorResponse('Active Seller shop required'), '409': errorResponse('Voucher code already exists'), '422': errorResponse('Invalid voucher fields') },
        },
      },
      '/seller/vouchers/{voucher_id}': {
        get: { summary: 'Get a voucher belonging to the authenticated Seller shop', security: [{ BearerAuth: [] }], parameters: [{ name: 'voucher_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], responses: { '200': successResponse('Shop voucher'), '404': errorResponse('Voucher not found') } },
        patch: {
          summary: 'Update unused voucher conditions', security: [{ BearerAuth: [] }], parameters: [{ name: 'voucher_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', additionalProperties: false, properties: {
            code: { type: 'string', maxLength: 50 }, voucher_name: { type: 'string', maxLength: 150 }, discount_type: { type: 'string', enum: ['PERCENT', 'FIXED'] },
            discount_value: { type: 'string' }, max_discount: { type: ['string', 'null'] }, min_order_value: { type: 'string' }, quantity: { type: 'integer', minimum: 0 }, start_at: { type: 'string', format: 'date-time' }, end_at: { type: 'string', format: 'date-time' },
          } }),
          responses: { '200': successResponse('Shop voucher updated'), '404': errorResponse('Voucher not found'), '409': errorResponse('Used voucher conditions cannot be changed'), '422': errorResponse('Invalid voucher fields') },
        },
      },
      '/seller/vouchers/{voucher_id}/status': {
        patch: { summary: 'Activate or deactivate a Seller shop voucher', security: [{ BearerAuth: [] }], parameters: [{ name: 'voucher_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], requestBody: jsonRequest({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] } } }), responses: { '200': successResponse('Voucher status updated'), '404': errorResponse('Voucher not found'), '422': errorResponse('Invalid status') } },
      },
      '/seller/reports/revenue': {
        get: {
          summary: 'Get completed-order revenue report for the authenticated Seller shop', security: [{ BearerAuth: [] }],
          parameters: [
            { name: 'from', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
            { name: 'to', in: 'query', required: false, schema: { type: 'string', format: 'date-time' } },
          ],
          responses: { '200': successResponse('Seller revenue report'), '403': errorResponse('Active Seller shop required'), '422': errorResponse('REPORT_FILTER_INVALID') },
        },
      },
      '/seller/products/{id}/status': {
        patch: {
          summary: 'Update product status', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] } } }),
          responses: { '200': successResponse('Product status updated'), '403': errorResponse('Seller role required'), '404': errorResponse('Product not found') },
        },
      },
      '/products/{product_id}/status': {
        patch: {
          summary: 'Update product status (alias)', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'product_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] } } }),
          responses: { '200': successResponse('Product status updated'), '403': errorResponse('Seller role required'), '404': errorResponse('Product not found') },
        },
      },
      '/admin/categories': {
        get: {
          summary: 'List all categories for admin', security: [{ BearerAuth: [] }],
          responses: { '200': successResponse('Categories list'), '403': errorResponse('Admin role required') },
        },
        post: {
          summary: 'Create category', security: [{ BearerAuth: [] }],
          requestBody: jsonRequest({ type: 'object', required: ['name'], properties: { name: { type: 'string' }, parent_id: { type: ['string', 'null'] }, description: { type: ['string', 'null'] }, status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] } } }),
          responses: { '201': successResponse('Category created'), '403': errorResponse('Admin role required'), '422': errorResponse('Validation failed') },
        },
      },
      '/admin/categories/{id}': {
        patch: {
          summary: 'Update category', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', properties: { name: { type: 'string' }, parent_id: { type: ['string', 'null'] }, description: { type: ['string', 'null'] } } }),
          responses: { '200': successResponse('Category updated'), '403': errorResponse('Admin role required'), '404': errorResponse('Category not found'), '422': errorResponse('Validation failed') },
        },
      },
      '/admin/categories/{id}/status': {
        patch: {
          summary: 'Update category status', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', required: ['status'], properties: { status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] } } }),
          responses: { '200': successResponse('Category status updated'), '403': errorResponse('Admin role required'), '404': errorResponse('Category not found'), '422': errorResponse('Validation failed') },
        },
      },
      '/media/uploads/presign': {
        post: {
          summary: 'Presign media upload', security: [{ BearerAuth: [] }],
          requestBody: jsonRequest({ type: 'object', required: ['filename', 'content_type'], properties: { filename: { type: 'string' }, content_type: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] }, purpose: { type: 'string', enum: ['product_image', 'avatar_image'] }, product_id: { type: 'string', format: 'uuid', description: 'Required for product_image; omitted for avatar_image.' } } }),
          responses: { '201': successResponse('Presigned upload URL'), '401': errorResponse('Authentication required'), '422': errorResponse('Invalid parameters') },
        },
      },
      '/media/uploads/{media_id}/finalize': {
        post: {
          summary: 'Finalize media upload', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'media_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', additionalProperties: false }),
          responses: { '200': successResponse('Media finalized'), '401': errorResponse('Authentication required'), '404': errorResponse('Upload not found'), '422': errorResponse('Magic bytes invalid') },
        },
      },
      '/media/uploads/{media_id}': {
        delete: {
          summary: 'Delete unattached media upload', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'media_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: { '204': { description: 'Media deleted' }, '401': errorResponse('Authentication required') },
        },
      },
      '/media/uploads/{media_id}/attach': {
        patch: {
          summary: 'Attach media upload to resource', security: [{ BearerAuth: [] }],
          parameters: [{ name: 'media_id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          requestBody: jsonRequest({ type: 'object', required: ['product_id'], properties: { product_id: { type: 'string', format: 'uuid' } } }),
          responses: { '200': successResponse('Media attached'), '401': errorResponse('Authentication required'), '404': errorResponse('Upload not found') },
        },
      },
    },
  };
}
