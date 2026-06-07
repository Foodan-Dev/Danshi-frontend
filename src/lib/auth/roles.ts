import type { User } from '@/src/models/User';
import { ROLE_ORDER, ROLES } from '@/src/constants/app';

export type Role = User['role'];

const order: Role[] = ROLE_ORDER as Role[];
const rank = (r: Role) => order.indexOf(r);

export function hasRoleAtLeast(current: Role, required: Role) {
  return rank(current) >= rank(required);
}

export function isAdmin(role: Role) {
  return hasRoleAtLeast(role, 'admin');
}

export function isSuperAdmin(role: Role) {
  return role === ROLES.SUPER_ADMIN;
}

export const Roles = { order, hasRoleAtLeast, isAdmin, isSuperAdmin };
