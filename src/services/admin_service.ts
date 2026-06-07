import { adminRepository } from '@/src/repositories/admin_repository';
import type {
  AdminPostListParams,
  AdminPendingPostsResponse,
  AdminPostReviewInput,
  AdminPostReviewResult,
  AdminUserListParams,
  AdminUsersResponse,
  AdminUserRoleInput,
  AdminUserRoleResult,
  AdminUserStatusInput,
  AdminUserStatusResult,
  AdminCommentsResponse,
  AdminCommentListParams,
  AdminPostsResponse,
} from '@/src/repositories/admin_repository';
import { AppError } from '@/src/lib/errors/app_error';
import { ROLES, type Role } from '@/src/constants/app';

const sanitizePaginationParams = <T extends { page?: number; limit?: number }>(params: T): T => {
  const result: T = { ...params };
  if (result.page !== undefined) {
    result.page = Math.max(1, Math.floor(result.page));
  }
  if (result.limit !== undefined) {
    result.limit = Math.max(1, Math.min(50, Math.floor(result.limit)));
  }
  return result;
};

const isValidRole = (role: string): role is typeof ROLES[keyof typeof ROLES] => {
  return Object.values(ROLES).includes(role as typeof ROLES[keyof typeof ROLES]);
};

const VALID_POST_STATUS = new Set(['pending', 'approved', 'rejected', 'draft']);
const VALID_POST_TYPES = new Set(['share', 'seeking']);

export const adminService = {
  async getPendingPosts(params: AdminPostListParams = {}): Promise<AdminPendingPostsResponse> {
    const sanitized = sanitizePaginationParams(params);
    return adminRepository.listPendingPosts(sanitized);
  },

  async getPosts(params: AdminPostListParams = {}): Promise<AdminPostsResponse> {
    const sanitized = sanitizePaginationParams(params);
    if (sanitized.status && !VALID_POST_STATUS.has(sanitized.status)) {
      throw new AppError('无效的帖子状态筛选');
    }
    if (sanitized.post_type && !VALID_POST_TYPES.has(sanitized.post_type)) {
      throw new AppError('无效的帖子类型筛选');
    }
    return adminRepository.listPosts(sanitized);
  },

  async reviewPost(postId: string, input: AdminPostReviewInput): Promise<AdminPostReviewResult> {
    if (!postId?.trim()) throw new AppError('缺少帖子ID');
    if (!['approved', 'rejected'].includes(input.status)) throw new AppError('无效的审核状态');
    return adminRepository.reviewPost(postId, input);
  },

  async deletePost(postId: string): Promise<{ post_id: string }> {
    if (!postId?.trim()) throw new AppError('缺少帖子ID');
    return adminRepository.deletePost(postId.trim());
  },

  async getUsers(params: AdminUserListParams = {}): Promise<AdminUsersResponse> {
    const sanitized = sanitizePaginationParams(params);
    if (sanitized.role && !isValidRole(sanitized.role)) {
      throw new AppError('无效的用户角色');
    }
    return adminRepository.listUsers(sanitized);
  },

  async getAdmins(params: AdminUserListParams = {}): Promise<AdminUsersResponse> {
    const sanitized = sanitizePaginationParams(params);
    return adminRepository.listAdmins(sanitized);
  },

  async getSuperAdmins(params: AdminUserListParams = {}): Promise<AdminUsersResponse> {
    const sanitized = sanitizePaginationParams(params);
    return adminRepository.listSuperAdmins(sanitized);
  },

  async updateUserRole(userId: string, input: AdminUserRoleInput): Promise<AdminUserRoleResult> {
    if (!userId?.trim()) throw new AppError('缺少用户ID');
    if (!input?.role || !isValidRole(input.role)) throw new AppError('无效的角色设定');
    return adminRepository.updateUserRole(userId, input);
  },

  async updateUserStatus(userId: string, input: AdminUserStatusInput): Promise<AdminUserStatusResult> {
    if (!userId?.trim()) throw new AppError('缺少用户ID');
    if (typeof input?.is_active !== 'boolean') throw new AppError('缺少用户状态');
    return adminRepository.updateUserStatus(userId, input);
  },

  async getComments(params: AdminCommentListParams = {}): Promise<AdminCommentsResponse> {
    const sanitized = sanitizePaginationParams(params);
    return adminRepository.listComments(sanitized);
  },

  async deleteComment(commentId: string): Promise<{ comment_id: string }> {
    if (!commentId?.trim()) throw new AppError('缺少评论ID');
    return adminRepository.deleteComment(commentId.trim());
  },

  /**
   * 检测当前用户的角色
   * 通过尝试调用不同权限级别的 admin 接口来判断
   * @returns 'super_admin' | 'admin' | 'user'
   */
  async detectCurrentUserRole(): Promise<Role> {
    // 1. 先尝试调用超级管理员专属接口
    try {
      await adminRepository.listAdmins({ limit: 1 });
      // 成功 → 是超级管理员
      return ROLES.SUPER_ADMIN;
    } catch (error) {
      const appError = AppError.from(error, '角色检测失败');
      // 403 说明没有超级管理员权限，继续检测
      if (appError.status !== 403) {
        throw appError;
      }
    }

    // 2. 再尝试调用普通管理员接口
    try {
      await adminRepository.listPendingPosts({ limit: 1 });
      // 成功 → 是普通管理员
      return ROLES.ADMIN;
    } catch (error) {
      const appError = AppError.from(error, '角色检测失败');
      // 403 说明没有管理员权限
      if (appError.status !== 403) {
        throw appError;
      }
    }

    // 3. 都失败 → 普通用户
    return ROLES.USER;
  },
};
