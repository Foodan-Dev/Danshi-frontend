import { API_ENDPOINTS } from '@/src/constants/app';
import type { Role } from '@/src/constants/app';
import type { components } from '@/src/generated/openapi';
import { AppError } from '@/src/lib/errors/app_error';
import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import type { Category, PostType } from '@/src/models/Post';
import type { ManagementRole } from '@/src/models/User';
import { normalizeRoles, primaryRole } from '@/src/lib/auth/roles';
import { requireNumber, requireString, toPagination } from '@/src/repositories/api_mappers';

type AdminPostListContract = components['schemas']['AdminPostList'];
type AdminPostContract = components['schemas']['AdminPostView'];
type AdminCommentListContract = components['schemas']['AdminCommentList'];
type AdminCommentContract = components['schemas']['AdminCommentView'];
type AdminUserListContract = components['schemas']['AdminUserList'];
type AdminUserContract = components['schemas']['AdminUserView'];

export type Pagination = ReturnType<typeof toPagination>;
export type AdminPostListParams = {
  page?: number;
  limit?: number;
  status?: 'pending' | 'approved' | 'rejected' | 'draft';
  post_type?: PostType;
};
export type AdminPendingPostSummary = {
  id: number;
  title: string;
  content: string;
  category: Category;
  post_type: PostType;
  images: string[];
  image_thumbs?: string[];
  image_displays?: string[];
  author?: { id: number; name: string; email?: string };
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  like_count: number;
  view_count: number;
  comment_count: number;
  created_at: string;
};
export type AdminPendingPostsResponse = { posts: AdminPendingPostSummary[]; pagination: Pagination };
export type AdminPostsResponse = AdminPendingPostsResponse;
export type AdminPostReviewInput = { status: 'approved' | 'rejected'; feedback?: string };
export type AdminPostReviewResult = {
  post_id: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
  reviewed_at: string;
  moderation_record_ids: number[];
};
export type AdminPostRestoreResult = { post_id: number; moderation_record_id: number };

export type AdminUserListParams = { page?: number; limit?: number; role?: ManagementRole; is_active?: boolean };
export type AdminUserSummary = {
  id: number;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: Role;
  roles: ManagementRole[];
  is_active: boolean | null;
  is_banned: boolean | null;
  ban_reason: string | null;
  banned_until: string | null;
  ban_is_permanent: boolean | null;
  banned_by: number | null;
  stats: { post_count: number; follower_count: number };
  created_at: string | null;
};
export type AdminUsersResponse = { users: AdminUserSummary[]; pagination: Pagination };
export type AdminUserRoleInput = { role: ManagementRole; action: 'grant' | 'revoke' };
export type AdminUserRoleResult = {
  user_id: number;
  role: ManagementRole;
  action: 'grant' | 'revoke';
  roles: ManagementRole[];
  changed: boolean;
};
export type AdminUserStatusInput = components['schemas']['adminUserStatusRequest'];
export type AdminUserStatusResult = {
  user_id: number;
  is_active: boolean | null;
  is_banned: boolean | null;
  ban_reason: string | null;
  banned_until: string | null;
  ban_is_permanent: boolean | null;
  banned_by: number | null;
};

export type AdminUserBanState =
  | { kind: 'none' }
  | { kind: 'timed'; bannedUntil: string }
  | { kind: 'permanent' }
  | { kind: 'unknown' };

export type AdminCommentListParams = { page?: number; limit?: number; post_id?: number };
export type AdminCommentSummary = {
  id: number;
  content: string;
  post_id: number;
  author: { id: number; name: string; email?: string };
  parent_id: number | null;
  like_count: number;
  reply_count: number;
  created_at: string;
};
export type AdminCommentsResponse = { comments: AdminCommentSummary[]; pagination: Pagination };

const isRole = (value: string | undefined): value is ManagementRole =>
  value === 'dict_reviewer' || value === 'moderator' || value === 'super_admin';

const toNullableText = (value: string | null | undefined): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const toOptionalPositiveInteger = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : null;

export const getAdminUserBanState = (
  user: Pick<AdminUserSummary, 'is_banned' | 'ban_is_permanent' | 'banned_until'>,
  now = Date.now(),
): AdminUserBanState => {
  if (user.ban_is_permanent === true) return { kind: 'permanent' };

  if (user.banned_until) {
    const bannedUntil = Date.parse(user.banned_until);
    if (Number.isFinite(bannedUntil) && bannedUntil > now) {
      return { kind: 'timed', bannedUntil: user.banned_until };
    }
    return { kind: 'none' };
  }

  if (user.ban_is_permanent === false || user.is_banned === false) return { kind: 'none' };

  // 仅在服务端缺少封禁形态字段时，才以 is_banned 作为兼容回退。
  return user.is_banned === true ? { kind: 'unknown' } : { kind: 'none' };
};

const toAdminPost = (post: AdminPostContract): AdminPendingPostSummary => {
  if (post.category !== 'food' && post.category !== 'recipe') {
    throw new AppError('服务端返回了无效的帖子分类');
  }
  if (post.post_type !== 'share' && post.post_type !== 'seeking') {
    throw new AppError('服务端返回了无效的帖子类型');
  }
  if (!post.status) throw new AppError('服务端响应缺少帖子状态');
  const imageVariants = post as AdminPostContract & {
    image_thumbs?: string[];
    image_displays?: string[];
  };
  return {
    id: requireNumber(post.id, '帖子 ID'),
    title: requireString(post.title, '帖子标题'),
    content: requireString(post.content, '帖子正文'),
    category: post.category,
    post_type: post.post_type,
    images: post.images ?? [],
    image_thumbs: imageVariants.image_thumbs ?? [],
    image_displays: imageVariants.image_displays ?? [],
    author: post.author ? {
      id: requireNumber(post.author.id, '作者 ID'),
      name: requireString(post.author.name, '作者名称'),
      email: post.author.email,
    } : undefined,
    status: post.status,
    like_count: post.like_count ?? 0,
    view_count: post.view_count ?? 0,
    comment_count: post.comment_count ?? 0,
    created_at: requireString(post.created_at, '帖子创建时间'),
  };
};

const toAdminComment = (comment: AdminCommentContract): AdminCommentSummary => ({
  id: requireNumber(comment.id, '评论 ID'),
  content: requireString(comment.content, '评论正文'),
  post_id: requireNumber(comment.post_id, '帖子 ID'),
  author: {
    id: requireNumber(comment.author?.id, '评论作者 ID'),
    name: requireString(comment.author?.name, '评论作者名称'),
    email: comment.author?.email,
  },
  parent_id: comment.parent_id ?? null,
  like_count: comment.like_count ?? 0,
  reply_count: comment.reply_count ?? 0,
  created_at: requireString(comment.created_at, '评论创建时间'),
});

const toAdminUser = (user: AdminUserContract): AdminUserSummary => {
  const roles = normalizeRoles(user.roles);
  return {
    id: requireNumber(user.id, '用户 ID'),
    name: toNullableText(user.name),
    email: toNullableText(user.email),
    avatar_url: user.avatar_url ?? null,
    role: primaryRole(roles),
    roles,
    is_active: typeof user.is_active === 'boolean' ? user.is_active : null,
    is_banned: typeof user.is_banned === 'boolean' ? user.is_banned : null,
    ban_reason: toNullableText(user.ban_reason),
    banned_until: toNullableText(user.banned_until),
    ban_is_permanent: typeof user.ban_is_permanent === 'boolean' ? user.ban_is_permanent : null,
    banned_by: toOptionalPositiveInteger(user.banned_by),
    stats: {
      post_count: user.stats?.post_count ?? 0,
      follower_count: user.stats?.follower_count ?? 0,
    },
    created_at: toNullableText(user.created_at),
  };
};

const withQuery = (path: string, params: object) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, String(value));
  });
  return query.size ? `${path}?${query.toString()}` : path;
};
const mapPostList = (payload: AdminPostListContract): AdminPostsResponse => ({
  posts: (payload.posts ?? []).map(toAdminPost),
  pagination: toPagination(payload.pagination),
});
const mapUserList = (payload: AdminUserListContract): AdminUsersResponse => {
  const users: AdminUserSummary[] = [];
  const rows = Array.isArray(payload.users) ? payload.users : [];
  for (const user of rows) {
    try {
      users.push(toAdminUser(user));
    } catch {
      // ID 是列表 key 与所有管理操作的依据；缺少有效 ID 的单行只能跳过，不能拖垮整页。
    }
  }
  return { users, pagination: toPagination(payload.pagination) };
};
const mapCommentList = (payload: AdminCommentListContract): AdminCommentsResponse => ({
  comments: (payload.comments ?? []).map(toAdminComment),
  pagination: toPagination(payload.pagination),
});

export interface AdminRepository {
  listPendingPosts(params?: AdminPostListParams): Promise<AdminPendingPostsResponse>;
  listPosts(params?: AdminPostListParams): Promise<AdminPostsResponse>;
  reviewPost(postId: number, input: AdminPostReviewInput): Promise<AdminPostReviewResult>;
  deletePost(postId: number): Promise<{ post_id: number }>;
  restorePost(postId: number): Promise<AdminPostRestoreResult>;
  listUsers(params?: AdminUserListParams): Promise<AdminUsersResponse>;
  listAdmins(params?: AdminUserListParams): Promise<AdminUsersResponse>;
  listSuperAdmins(params?: AdminUserListParams): Promise<AdminUsersResponse>;
  updateUserRole(userId: number, input: AdminUserRoleInput): Promise<AdminUserRoleResult>;
  updateUserStatus(userId: number, input: AdminUserStatusInput): Promise<AdminUserStatusResult>;
  listComments(params?: AdminCommentListParams): Promise<AdminCommentsResponse>;
  deleteComment(commentId: number): Promise<{ comment_id: number }>;
}

class ApiAdminRepository implements AdminRepository {
  async listPendingPosts(params: AdminPostListParams = {}) {
    const res = await httpAuth.get<ApiResponse<AdminPostListContract>>(
      withQuery(API_ENDPOINTS.ADMIN.POSTS_PENDING, params),
    );
    return mapPostList(unwrapApiResponse(res));
  }

  async listPosts(params: AdminPostListParams = {}) {
    const res = await httpAuth.get<ApiResponse<AdminPostListContract>>(
      withQuery(API_ENDPOINTS.ADMIN.POSTS, params),
    );
    return mapPostList(unwrapApiResponse(res));
  }

  async reviewPost(postId: number, input: AdminPostReviewInput) {
    const path = API_ENDPOINTS.ADMIN.POST_REVIEW.replace(':postId', String(postId));
    const res = await httpAuth.put<ApiResponse<components['schemas']['AdminPostReviewResult']>>(path, input);
    const result = unwrapApiResponse(res);
    if (!result.status) throw new AppError('服务端响应缺少审核状态');
    return {
      post_id: requireNumber(result.post_id, '帖子 ID'),
      status: result.status,
      reviewed_at: requireString(result.reviewed_at, '审核时间'),
      moderation_record_ids: (result.moderation_record_ids ?? []).filter(
        (id): id is number => Number.isSafeInteger(id) && id > 0,
      ),
    };
  }

  async deletePost(postId: number) {
    const path = API_ENDPOINTS.ADMIN.POST_DELETE.replace(':postId', String(postId));
    const res = await httpAuth.delete<ApiResponse<components['schemas']['AdminPostDeleteResult']>>(path);
    return { post_id: requireNumber(unwrapApiResponse(res).post_id, '帖子 ID') };
  }

  async restorePost(postId: number) {
    const path = API_ENDPOINTS.ADMIN.POST_RESTORE.replace(':postId', String(postId));
    const res = await httpAuth.put<ApiResponse<components['schemas']['AdminPostRestoreResult']>>(path);
    const result = unwrapApiResponse(res);
    return {
      post_id: requireNumber(result.post_id, '帖子 ID'),
      moderation_record_id: requireNumber(result.moderation_record_id, '审核记录 ID'),
    };
  }

  async listUsers(params: AdminUserListParams = {}) {
    const res = await httpAuth.get<ApiResponse<AdminUserListContract>>(withQuery(API_ENDPOINTS.ADMIN.USERS, params));
    return mapUserList(unwrapApiResponse(res));
  }

  async listAdmins(params: AdminUserListParams = {}) {
    const res = await httpAuth.get<ApiResponse<AdminUserListContract>>(withQuery(API_ENDPOINTS.ADMIN.ADMINS, params));
    return mapUserList(unwrapApiResponse(res));
  }

  async listSuperAdmins(params: AdminUserListParams = {}) {
    const res = await httpAuth.get<ApiResponse<AdminUserListContract>>(
      withQuery(API_ENDPOINTS.ADMIN.SUPER_ADMINS, params),
    );
    return mapUserList(unwrapApiResponse(res));
  }

  async updateUserRole(userId: number, input: AdminUserRoleInput) {
    const path = API_ENDPOINTS.ADMIN.USER_ROLE.replace(':userId', String(userId));
    const res = await httpAuth.put<ApiResponse<components['schemas']['AdminUserRoleResult']>>(path, input);
    const result = unwrapApiResponse(res);
    if (!isRole(result.role)) throw new AppError('服务端返回了无效的用户角色');
    if (result.action !== 'grant' && result.action !== 'revoke') {
      throw new AppError('服务端返回了无效的角色操作');
    }
    return {
      user_id: requireNumber(result.user_id, '用户 ID'),
      role: result.role,
      action: result.action,
      roles: normalizeRoles(result.roles),
      changed: result.changed ?? false,
    };
  }

  async updateUserStatus(userId: number, input: AdminUserStatusInput) {
    const path = API_ENDPOINTS.ADMIN.USER_STATUS.replace(':userId', String(userId));
    const res = await httpAuth.put<ApiResponse<components['schemas']['AdminUserStatusResult']>>(path, input);
    const result = unwrapApiResponse(res);
    return {
      user_id: requireNumber(result.user_id, '用户 ID'),
      is_active: typeof result.is_active === 'boolean' ? result.is_active : null,
      is_banned: typeof result.is_banned === 'boolean' ? result.is_banned : null,
      ban_reason: toNullableText(result.ban_reason),
      banned_until: toNullableText(result.banned_until),
      ban_is_permanent: typeof result.ban_is_permanent === 'boolean' ? result.ban_is_permanent : null,
      banned_by: toOptionalPositiveInteger(result.banned_by),
    };
  }

  async listComments(params: AdminCommentListParams = {}) {
    const res = await httpAuth.get<ApiResponse<AdminCommentListContract>>(
      withQuery(API_ENDPOINTS.ADMIN.COMMENTS, params),
    );
    return mapCommentList(unwrapApiResponse(res));
  }

  async deleteComment(commentId: number) {
    const path = API_ENDPOINTS.ADMIN.COMMENT_DELETE.replace(':commentId', String(commentId));
    const res = await httpAuth.delete<ApiResponse<components['schemas']['AdminCommentDeleteResult']>>(path);
    return { comment_id: requireNumber(unwrapApiResponse(res).comment_id, '评论 ID') };
  }
}

export const adminRepository: AdminRepository = new ApiAdminRepository();
