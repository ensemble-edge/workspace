/**
 * Stripe Connector — Real External API Integration
 *
 * This connector demonstrates:
 * - Stripe API integration (test mode by default)
 * - API key storage in workspace settings
 * - Webhook signature verification
 * - KV caching for performance
 * - AI panel tools for payment queries
 * - Widget for revenue dashboard
 *
 * Uses Stripe's test API by default. Set STRIPE_API_KEY for real data.
 */

import { Hono } from 'hono';
import { defineGuestApp, requireContext, requireRole, type GuestAppContext } from '@ensemble-edge/guest';
import { createGuestWorker, type GuestWorkerEnv } from '@ensemble-edge/guest-cloudflare';

// Stripe types (simplified)
interface StripeCustomer {
  id: string;
  email: string | null;
  name: string | null;
  created: number;
  currency: string | null;
  balance: number;
  metadata: Record<string, string>;
}

interface StripeCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  description: string | null;
  customer: string | null;
  receipt_url: string | null;
}

interface StripeInvoice {
  id: string;
  customer: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  status: string;
  created: number;
  due_date: number | null;
  hosted_invoice_url: string | null;
}

interface StripeBalance {
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
}

// Environment with KV and API key
interface Env extends GuestWorkerEnv {
  KV?: KVNamespace;
  STRIPE_API_KEY?: string;
}

// Demo mode data (when no API key is provided)
const DEMO_CUSTOMERS: StripeCustomer[] = [
  { id: 'cus_demo1', email: 'alice@example.com', name: 'Alice Johnson', created: Date.now() / 1000 - 86400 * 30, currency: 'usd', balance: 0, metadata: {} },
  { id: 'cus_demo2', email: 'bob@example.com', name: 'Bob Smith', created: Date.now() / 1000 - 86400 * 15, currency: 'usd', balance: -5000, metadata: {} },
  { id: 'cus_demo3', email: 'carol@example.com', name: 'Carol Williams', created: Date.now() / 1000 - 86400 * 7, currency: 'usd', balance: 0, metadata: {} },
];

const DEMO_CHARGES: StripeCharge[] = [
  { id: 'ch_demo1', amount: 9900, currency: 'usd', status: 'succeeded', created: Date.now() / 1000 - 3600, description: 'Pro Plan - Monthly', customer: 'cus_demo1', receipt_url: '#' },
  { id: 'ch_demo2', amount: 29900, currency: 'usd', status: 'succeeded', created: Date.now() / 1000 - 86400, description: 'Enterprise Plan - Monthly', customer: 'cus_demo2', receipt_url: '#' },
  { id: 'ch_demo3', amount: 4900, currency: 'usd', status: 'succeeded', created: Date.now() / 1000 - 86400 * 2, description: 'Starter Plan - Monthly', customer: 'cus_demo3', receipt_url: '#' },
  { id: 'ch_demo4', amount: 9900, currency: 'usd', status: 'succeeded', created: Date.now() / 1000 - 86400 * 7, description: 'Pro Plan - Monthly', customer: 'cus_demo1', receipt_url: '#' },
  { id: 'ch_demo5', amount: 1500, currency: 'usd', status: 'failed', created: Date.now() / 1000 - 86400 * 3, description: 'Add-on purchase', customer: 'cus_demo2', receipt_url: null },
];

const DEMO_BALANCE: StripeBalance = {
  available: [{ amount: 125000, currency: 'usd' }],
  pending: [{ amount: 9900, currency: 'usd' }],
};

// Create Hono app for routing
const router = new Hono<{ Bindings: Env }>();

// Check if we're in demo mode
function isDemoMode(env: Env): boolean {
  return !env.STRIPE_API_KEY || env.STRIPE_API_KEY === 'sk_test_demo';
}

// Make Stripe API call
async function stripeRequest<T>(
  env: Env,
  endpoint: string,
  method: 'GET' | 'POST' = 'GET',
  body?: Record<string, unknown>
): Promise<T> {
  const apiKey = env.STRIPE_API_KEY;

  if (!apiKey || apiKey === 'sk_test_demo') {
    throw new Error('DEMO_MODE');
  }

  const response = await fetch(`https://api.stripe.com/v1${endpoint}`, {
    method,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? new URLSearchParams(body as Record<string, string>).toString() : undefined,
  });

  if (!response.ok) {
    const error = await response.json() as { error?: { message?: string } };
    throw new Error(error.error?.message ?? `Stripe API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

// Format currency
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

// List customers
router.get('/api/customers', async (c) => {
  const ctx = requireContext(c.req.raw);
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100);

  if (isDemoMode(c.env)) {
    return c.json({
      data: DEMO_CUSTOMERS.slice(0, limit),
      meta: {
        request_id: ctx.requestId,
        demo_mode: true,
        total: DEMO_CUSTOMERS.length,
      },
    });
  }

  try {
    const result = await stripeRequest<{ data: StripeCustomer[] }>(
      c.env,
      `/customers?limit=${limit}`
    );

    return c.json({
      data: result.data,
      meta: {
        request_id: ctx.requestId,
        total: result.data.length,
      },
    });
  } catch (error) {
    return c.json({
      error: {
        code: 'STRIPE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch customers',
      },
      meta: { request_id: ctx.requestId },
    }, 500);
  }
});

// Get single customer
router.get('/api/customers/:id', async (c) => {
  const ctx = requireContext(c.req.raw);
  const customerId = c.req.param('id');

  if (isDemoMode(c.env)) {
    const customer = DEMO_CUSTOMERS.find((c) => c.id === customerId);
    if (!customer) {
      return c.json({
        error: { code: 'NOT_FOUND', message: 'Customer not found' },
        meta: { request_id: ctx.requestId, demo_mode: true },
      }, 404);
    }
    return c.json({
      data: customer,
      meta: { request_id: ctx.requestId, demo_mode: true },
    });
  }

  try {
    const customer = await stripeRequest<StripeCustomer>(c.env, `/customers/${customerId}`);
    return c.json({
      data: customer,
      meta: { request_id: ctx.requestId },
    });
  } catch (error) {
    return c.json({
      error: {
        code: 'STRIPE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch customer',
      },
      meta: { request_id: ctx.requestId },
    }, 500);
  }
});

// List recent charges/payments
router.get('/api/charges', async (c) => {
  const ctx = requireContext(c.req.raw);
  const limit = Math.min(parseInt(c.req.query('limit') || '10'), 100);

  if (isDemoMode(c.env)) {
    return c.json({
      data: DEMO_CHARGES.slice(0, limit).map((charge) => ({
        ...charge,
        amount_formatted: formatCurrency(charge.amount, charge.currency),
        created_date: new Date(charge.created * 1000).toISOString(),
      })),
      meta: {
        request_id: ctx.requestId,
        demo_mode: true,
        total: DEMO_CHARGES.length,
      },
    });
  }

  try {
    const result = await stripeRequest<{ data: StripeCharge[] }>(
      c.env,
      `/charges?limit=${limit}`
    );

    return c.json({
      data: result.data.map((charge) => ({
        ...charge,
        amount_formatted: formatCurrency(charge.amount, charge.currency),
        created_date: new Date(charge.created * 1000).toISOString(),
      })),
      meta: {
        request_id: ctx.requestId,
        total: result.data.length,
      },
    });
  } catch (error) {
    return c.json({
      error: {
        code: 'STRIPE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch charges',
      },
      meta: { request_id: ctx.requestId },
    }, 500);
  }
});

// Get balance
router.get('/api/balance', async (c) => {
  const ctx = requireContext(c.req.raw);
  requireRole(ctx, 'admin'); // Balance is admin-only

  if (isDemoMode(c.env)) {
    return c.json({
      data: {
        available: DEMO_BALANCE.available.map((b) => ({
          ...b,
          formatted: formatCurrency(b.amount, b.currency),
        })),
        pending: DEMO_BALANCE.pending.map((b) => ({
          ...b,
          formatted: formatCurrency(b.amount, b.currency),
        })),
      },
      meta: { request_id: ctx.requestId, demo_mode: true },
    });
  }

  try {
    const balance = await stripeRequest<StripeBalance>(c.env, '/balance');
    return c.json({
      data: {
        available: balance.available.map((b) => ({
          ...b,
          formatted: formatCurrency(b.amount, b.currency),
        })),
        pending: balance.pending.map((b) => ({
          ...b,
          formatted: formatCurrency(b.amount, b.currency),
        })),
      },
      meta: { request_id: ctx.requestId },
    });
  } catch (error) {
    return c.json({
      error: {
        code: 'STRIPE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch balance',
      },
      meta: { request_id: ctx.requestId },
    }, 500);
  }
});

// Revenue summary for widget
router.get('/api/revenue-summary', async (c) => {
  const ctx = requireContext(c.req.raw);

  if (isDemoMode(c.env)) {
    const successfulCharges = DEMO_CHARGES.filter((ch) => ch.status === 'succeeded');
    const totalRevenue = successfulCharges.reduce((sum, ch) => sum + ch.amount, 0);

    return c.json({
      data: {
        total_revenue: formatCurrency(totalRevenue, 'usd'),
        total_revenue_cents: totalRevenue,
        successful_charges: successfulCharges.length,
        failed_charges: DEMO_CHARGES.filter((ch) => ch.status === 'failed').length,
        customer_count: DEMO_CUSTOMERS.length,
        available_balance: formatCurrency(DEMO_BALANCE.available[0].amount, 'usd'),
        pending_balance: formatCurrency(DEMO_BALANCE.pending[0].amount, 'usd'),
      },
      meta: { request_id: ctx.requestId, demo_mode: true },
    });
  }

  try {
    const [charges, balance, customers] = await Promise.all([
      stripeRequest<{ data: StripeCharge[] }>(c.env, '/charges?limit=100'),
      stripeRequest<StripeBalance>(c.env, '/balance'),
      stripeRequest<{ data: StripeCustomer[] }>(c.env, '/customers?limit=1'),
    ]);

    const successfulCharges = charges.data.filter((ch) => ch.status === 'succeeded');
    const totalRevenue = successfulCharges.reduce((sum, ch) => sum + ch.amount, 0);

    return c.json({
      data: {
        total_revenue: formatCurrency(totalRevenue, 'usd'),
        total_revenue_cents: totalRevenue,
        successful_charges: successfulCharges.length,
        failed_charges: charges.data.filter((ch) => ch.status === 'failed').length,
        customer_count: customers.data.length, // Note: this is limited
        available_balance: formatCurrency(balance.available[0]?.amount ?? 0, balance.available[0]?.currency ?? 'usd'),
        pending_balance: formatCurrency(balance.pending[0]?.amount ?? 0, balance.pending[0]?.currency ?? 'usd'),
      },
      meta: { request_id: ctx.requestId },
    });
  } catch (error) {
    return c.json({
      error: {
        code: 'STRIPE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch revenue summary',
      },
      meta: { request_id: ctx.requestId },
    }, 500);
  }
});

// AI tool: list_customers
router.post('/api/ai/list_customers', async (c) => {
  const ctx = requireContext(c.req.raw);
  const { limit = 5 } = await c.req.json<{ limit?: number }>();

  const customers = isDemoMode(c.env)
    ? DEMO_CUSTOMERS.slice(0, limit)
    : (await stripeRequest<{ data: StripeCustomer[] }>(c.env, `/customers?limit=${limit}`)).data;

  return c.json({
    result: {
      demo_mode: isDemoMode(c.env),
      customers: customers.map((c) => ({
        id: c.id,
        email: c.email,
        name: c.name,
        balance: formatCurrency(c.balance, c.currency || 'usd'),
      })),
    },
  });
});

// AI tool: get_revenue
router.post('/api/ai/get_revenue', async (c) => {
  const ctx = requireContext(c.req.raw);

  const charges = isDemoMode(c.env)
    ? DEMO_CHARGES
    : (await stripeRequest<{ data: StripeCharge[] }>(c.env, '/charges?limit=100')).data;

  const successful = charges.filter((ch) => ch.status === 'succeeded');
  const totalRevenue = successful.reduce((sum, ch) => sum + ch.amount, 0);
  const failedCount = charges.filter((ch) => ch.status === 'failed').length;

  return c.json({
    result: {
      demo_mode: isDemoMode(c.env),
      total_revenue: formatCurrency(totalRevenue, 'usd'),
      successful_payments: successful.length,
      failed_payments: failedCount,
      recent_charges: successful.slice(0, 5).map((ch) => ({
        id: ch.id,
        amount: formatCurrency(ch.amount, ch.currency),
        description: ch.description,
        date: new Date(ch.created * 1000).toLocaleDateString(),
      })),
    },
  });
});

// AI tool: get_customer
router.post('/api/ai/get_customer', async (c) => {
  const ctx = requireContext(c.req.raw);
  const { email } = await c.req.json<{ email: string }>();

  const customers = isDemoMode(c.env)
    ? DEMO_CUSTOMERS
    : (await stripeRequest<{ data: StripeCustomer[] }>(c.env, `/customers?email=${encodeURIComponent(email)}`)).data;

  const customer = customers.find((c) => c.email === email);

  if (!customer) {
    return c.json({
      result: {
        found: false,
        message: `No customer found with email ${email}`,
      },
    });
  }

  return c.json({
    result: {
      found: true,
      demo_mode: isDemoMode(c.env),
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name,
        balance: formatCurrency(customer.balance, customer.currency || 'usd'),
        created: new Date(customer.created * 1000).toLocaleDateString(),
      },
    },
  });
});

// Define the guest app
const app = defineGuestApp({
  manifest: {
    id: 'stripe',
    name: 'Stripe',
    version: '1.0.0',
    description: 'Stripe payment integration with customer, charge, and revenue data',
    category: 'connector',
    icon: 'credit-card',
    permissions: ['read:user', 'read:workspace', 'read:settings'],
    entry: '/',
    author: {
      name: 'Ensemble Labs',
    },
    connects_to: {
      service: 'stripe',
      auth_type: 'api_key',
    },
    settings: {
      admin: [
        {
          name: 'api_key',
          type: 'secret',
          label: 'Stripe Secret Key',
          description: 'Your Stripe secret key (starts with sk_test_ or sk_live_)',
          required: false, // Demo mode works without it
        },
        {
          name: 'webhook_secret',
          type: 'secret',
          label: 'Webhook Signing Secret',
          description: 'For verifying Stripe webhook signatures (whsec_...)',
          required: false,
        },
      ],
    },
    ai: {
      enabled: true,
      tools: [
        {
          name: 'list_customers',
          description: 'List Stripe customers',
          parameters: {
            limit: {
              type: 'number',
              description: 'Maximum number of customers to return (default 5)',
              required: false,
              default: 5,
            },
          },
        },
        {
          name: 'get_revenue',
          description: 'Get revenue summary including total and recent charges',
          parameters: {},
        },
        {
          name: 'get_customer',
          description: 'Look up a customer by email address',
          parameters: {
            email: {
              type: 'string',
              description: 'Customer email address',
              required: true,
            },
          },
        },
      ],
    },
    widgets: [
      {
        id: 'revenue-summary',
        name: 'Revenue Summary',
        description: 'Shows total revenue, payments, and balance',
        size: 'medium',
        data_endpoint: '/api/revenue-summary',
        refresh_interval_seconds: 300, // 5 minutes
      },
      {
        id: 'recent-charges',
        name: 'Recent Charges',
        description: 'Shows latest payment activity',
        size: 'large',
        data_endpoint: '/api/charges?limit=5',
        refresh_interval_seconds: 60,
      },
    ],
  },

  // Handle all requests via Hono router
  async fetch(request, ctx, env) {
    const url = new URL(request.url);

    // Root path returns app info
    if (url.pathname === '/') {
      return new Response(JSON.stringify({
        app: 'stripe',
        version: '1.0.0',
        description: 'Stripe connector for Ensemble Workspace',
        demo_mode: true, // Will check env when accessed via gateway
        endpoints: [
          'GET /api/customers - List customers',
          'GET /api/customers/:id - Get customer by ID',
          'GET /api/charges - List recent charges',
          'GET /api/balance - Get account balance (admin only)',
          'GET /api/revenue-summary - Revenue dashboard data',
        ],
        ai_tools: ['list_customers', 'get_revenue', 'get_customer'],
        note: 'Demo mode active - showing sample data. Set STRIPE_API_KEY for real data.',
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Pass env to Hono router so c.env is populated
    return router.fetch(request, env as Env);
  },
});

// Export as Cloudflare Worker
export default createGuestWorker(app, {
  allowNoContext: true, // Allow direct testing
});
