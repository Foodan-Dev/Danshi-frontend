import type { DisplayRole, ManagementRole } from '@/src/models/User';
import { ROLE_ORDER, ROLES } from '@/src/constants/app';

export type Role = DisplayRole;
export type RolesInput = readonly ManagementRole[] | DisplayRole | null | undefined;

const order: Role[] = ROLE_ORDER as Role[];
const rank = (r: Role) => order.indexOf(r);

export function hasRoleAtLeast(current: Role, required: Role) {
  return rank(current) >= rank(required);
}

export function normalizeRoles(input: RolesInput): ManagementRole[] {
  const values = Array.isArray(input) ? input : input && input !== ROLES.USER ? [input] : [];
  return Array.from(new Set(values.filter((role): role is ManagementRole =>
    role === ROLES.DICT_REVIEWER || role === ROLES.MODERATOR || role === ROLES.SUPER_ADMIN,
  )));
}

export function primaryRole(input: RolesInput): DisplayRole {
  const roles = normalizeRoles(input);
  if (roles.includes(ROLES.SUPER_ADMIN)) return ROLES.SUPER_ADMIN;
  if (roles.includes(ROLES.MODERATOR)) return ROLES.MODERATOR;
  if (roles.includes(ROLES.DICT_REVIEWER)) return ROLES.DICT_REVIEWER;
  return ROLES.USER;
}

export function isAdmin(input: RolesInput) {
  return normalizeRoles(input).length > 0;
}

export function canReviewContent(input: RolesInput) {
  const roles = normalizeRoles(input);
  return roles.includes(ROLES.MODERATOR) || roles.includes(ROLES.SUPER_ADMIN);
}

export function canReviewDictionary(input: RolesInput) {
  const roles = normalizeRoles(input);
  return roles.includes(ROLES.DICT_REVIEWER) || roles.includes(ROLES.SUPER_ADMIN);
}

export function isSuperAdmin(input: RolesInput) {
  return normalizeRoles(input).includes(ROLES.SUPER_ADMIN);
}

export const Roles = {
  order,
  hasRoleAtLeast,
  normalizeRoles,
  primaryRole,
  isAdmin,
  canReviewContent,
  canReviewDictionary,
  isSuperAdmin,
};
