import { UserRole } from '../models/user.model';

/**
 * Role ID Utilities
 * 
 * PURPOSE: Bridge between frontend (string enums) and backend (numeric IDs)
 * 
 * WHY THIS EXISTS:
 * - Frontend uses: UserRole.WAITER = "WAITER" (string enum)
 * - Backend expects: roleId = 4 (numeric ID)
 * - This utility converts between the two formats
 * 
 * USE CASES:
 * 
 * 1. Creating/Updating Users via API:
 *    const userData = {
 *      username: 'john',
 *      roleId: getRoleId(UserRole.WAITER) // Converts "WAITER" → 4
 *    };
 *    apiService.post('/users', userData);
 * 
 * 2. Processing Backend Responses:
 *    const backendUser = { id: 1, roleId: 4 };
 *    const role = getRoleFromId(backendUser.roleId); // 4 → UserRole.WAITER
 *    permissionService.canAccessRoute('/dashboard', role);
 * 
 * 3. Role Selection Dropdowns:
 *    const roles = getAllRolesWithIds();
 *    // Use in template: <option *ngFor="let r of roles" [value]="r.id">
 * 
 * 4. Validation:
 *    if (!isValidRoleId(roleId)) {
 *      throw new Error('Invalid role');
 *    }
 */
export const ROLE_IDS: Record<UserRole, number> = {
  [UserRole.SUPER_ADMIN]: 1,
  [UserRole.ADMIN]: 2,
  [UserRole.RESTAURANT_MANAGER]: 3,
  [UserRole.SHIFT_MANAGER]: 4,
  [UserRole.WAITER]: 5,
  [UserRole.CASHIER]: 6,
  [UserRole.HOST]: 7,
  [UserRole.CHEF]: 8,
  [UserRole.BARTENDER]: 9,
  [UserRole.DELIVERY_DRIVER]: 10,
  [UserRole.INVENTORY_MANAGER]: 11,
  [UserRole.ACCOUNTANT]: 12,
  [UserRole.SALES_STAFF]: 13,
  [UserRole.STORE_MANAGER]: 14
} as const;

/**
 * Reverse mapping: Role ID to Role Name
 */
export const ROLE_NAMES: Record<number, UserRole> = {
  1: UserRole.SUPER_ADMIN,
  2: UserRole.ADMIN,
  3: UserRole.RESTAURANT_MANAGER,
  4: UserRole.SHIFT_MANAGER,
  5: UserRole.WAITER,
  6: UserRole.CASHIER,
  7: UserRole.HOST,
  8: UserRole.CHEF,
  9: UserRole.BARTENDER,
  10: UserRole.DELIVERY_DRIVER,
  11: UserRole.INVENTORY_MANAGER,
  12: UserRole.ACCOUNTANT,
  13: UserRole.SALES_STAFF,
  14: UserRole.STORE_MANAGER
} as const;

/**
 * Get role ID from role enum
 * @param role - The UserRole enum value
 * @returns The numeric role ID
 */
export function getRoleId(role: UserRole): number {
  return ROLE_IDS[role];
}

/**
 * Get role enum from role ID
 * @param roleId - The numeric role ID
 * @returns The UserRole enum value or undefined if not found
 */
export function getRoleFromId(roleId: number): UserRole | undefined {
  return ROLE_NAMES[roleId];
}

/**
 * Check if a role ID is valid
 * @param roleId - The numeric role ID to check
 * @returns True if the role ID exists
 */
export function isValidRoleId(roleId: number): boolean {
  return roleId in ROLE_NAMES;
}

/**
 * Get all available role IDs
 * @returns Array of all role IDs
 */
export function getAllRoleIds(): number[] {
  return Object.keys(ROLE_NAMES).map(Number);
}

/**
 * Get all roles with their IDs
 * @returns Array of objects with role name and ID
 */
export function getAllRolesWithIds(): Array<{ role: UserRole; id: number; name: string }> {
  return Object.entries(ROLE_IDS).map(([role, id]) => ({
    role: role as UserRole,
    id,
    name: role
  }));
}

