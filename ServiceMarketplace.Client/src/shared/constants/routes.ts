/**
 * Centralized route path constants.
 *
 * Every navigation target in the application must reference one of these
 * values instead of a raw string literal. This prevents typos, makes
 * refactoring trivial, and gives editors full autocomplete coverage.
 */
export const ROUTES = {
  LOGIN:    '/login',
  REGISTER: '/register',

  // Customer
  CUSTOMER:                     '/customer',
  CUSTOMER_REQUESTS:            '/customer/requests',
  CUSTOMER_SUBSCRIPTION:        '/customer/subscription',
  CUSTOMER_SUBSCRIPTION_SUCCESS:'/customer/subscription/success',
  CUSTOMER_ORG:                 '/customer/org',

  // Provider (both ProviderEmployee and ProviderAdmin)
  PROVIDER:     '/provider',
  PROVIDER_JOBS:'/provider/jobs',
  PROVIDER_MAP: '/provider/map',
  PROVIDER_ORG: '/provider/org',

  // Provider Admin only
  ORG: '/org',

  // Admin
  ADMIN:      '/admin',
  ADMIN_JOBS: '/admin/jobs',
  ADMIN_ORGS: '/admin/orgs',
  ADMIN_ROLES:'/admin/roles',
  ADMIN_LOGS: '/admin/logs',

  // Shared (all authenticated users)
  CHATS:    '/chats',
  ACTIVITY: '/activity',
} as const
