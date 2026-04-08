/**
 * Centralized permission name constants.
 *
 * Reference these instead of raw strings so that a permission rename
 * is a single-file change and typos are caught at compile time.
 */
export const PERMISSIONS = {
  REQUEST_CREATE:     'request.create',
  REQUEST_ACCEPT:     'request.accept',
  REQUEST_COMPLETE:   'request.complete',
  REQUEST_VIEW_ALL:   'request.view_all',
  ADMIN_MANAGE_USERS: 'admin.manage_users',
  ORG_MANAGE:         'org.manage',
  ORG_VIEW:           'org.view',
} as const
