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
      '/api/v1/health': {
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
      '/api/v1/addresses': {
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
      '/api/v1/addresses/{address_id}': {
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
            '200': {
              description: 'Address deleted',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessEnvelope' },
                },
              },
            },
          },
        },
      },
      '/api/v1/cart': {
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
      '/api/v1/cart/items': {
        post: {
          summary: 'Add Item to Cart',
          security: [{ BearerAuth: [] }],
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
      '/api/v1/checkout': {
        post: {
          summary: 'Execute Checkout',
          description: 'Place an order atomically from selected cart items.',
          security: [{ BearerAuth: [] }],
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
      '/api/v1/orders': {
        get: {
          summary: 'List Orders',
          security: [{ BearerAuth: [] }],
          responses: {
            '200': {
              description: 'List of orders with pagination',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PaginatedEnvelope' },
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
      '/api/v1/orders/{order_id}': {
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
      '/api/v1/orders/{order_id}/cancel': {
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
      '/api/v1/order-items/{order_item_id}/review': {
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
          },
        },
      },
      '/api/v1/vouchers': {
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
      '/api/v1/vouchers/evaluate': {
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
      '/api/v1/notifications': {
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
          },
        },
      },
      '/api/v1/notifications/{notification_id}/read': {
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
    },
  };
}
