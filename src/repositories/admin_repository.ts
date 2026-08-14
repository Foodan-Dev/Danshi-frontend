import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import { API_ENDPOINTS } from '@/src/constants/app';
import type { PostType, Category } from '@/src/models/Post';
import type { Role } from '@/src/constants/app';

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type AdminPostListParams = {
  page?: number;
  limit?: number;
  status?: 'pending' | 'approved' | 'rejected' | 'draft';
  post_type?: PostType;
};

export type AdminPendingPostSummary = {
  id: string;
  title: string;
  content: string;
  category: Category;
  post_type?: PostType;
  images?: string[];
  author: {
    id: string;
    name: string;
    email: string;
  };
  status: 'pending' | 'approved' | 'rejected';
  like_count?: number;
  view_count?: number;
  comment_count?: number;
  created_at: string;
};

export type AdminPendingPostsResponse = {
  posts: AdminPendingPostSummary[];
  pagination: Pagination;
};

export type AdminPostsResponse = AdminPendingPostsResponse;

export type AdminPostReviewInput = {
  status: 'approved' | 'rejected';
  feedback?: string;
};

export type AdminPostReviewResult = {
  post_id: string;
  status: 'approved' | 'rejected';
  reviewed_at: string;
};

export type AdminUserListParams = {
  page?: number;
  limit?: number;
  role?: Role;
  is_active?: boolean;
};

export type AdminUserSummary = {
  id: string;
  name: string;
  email: string;
  avatar_url?: string;
  role: Role;
  is_active: boolean;
  stats?: {
    post_count?: number;
    follower_count?: number;
  };
  created_at: string;
};

export type AdminUsersResponse = {
  users: AdminUserSummary[];
  pagination: Pagination;
};

export type AdminUserRoleInput = {
  role: Role;
};

export type AdminUserRoleResult = {
  user_id: string;
  role: Role;
};

export type AdminUserStatusInput = {
  is_active: boolean;
  reason?: string;
};

export type AdminUserStatusResult = {
  user_id: string;
  is_active: boolean;
};

const mapQueryKey = (key: string): string => {
  switch (key) {
    case 'postType':
      return 'post_type';
    case 'postId':
      return 'post_id';
    case 'isActive':
      return 'is_active';
    default:
      return key;
  }
};

const appendQueryParam = (qs: URLSearchParams, key: string, value: unknown) => {
  if (value == null) return;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return;
    qs.set(mapQueryKey(key), trimmed);
    return;
  }
  qs.set(mapQueryKey(key), String(value));
};

export interface AdminRepository {
  listPendingPosts(params?: AdminPostListParams): Promise<AdminPendingPostsResponse>;
  listPosts(params?: AdminPostListParams): Promise<AdminPostsResponse>;
  reviewPost(postId: string, input: AdminPostReviewInput): Promise<AdminPostReviewResult>;
  listUsers(params?: AdminUserListParams): Promise<AdminUsersResponse>;
  updateUserRole(userId: string, input: AdminUserRoleInput): Promise<AdminUserRoleResult>;
  updateUserStatus(userId: string, input: AdminUserStatusInput): Promise<AdminUserStatusResult>;
  listAdmins(params?: AdminUserListParams): Promise<AdminUsersResponse>;
  listSuperAdmins(params?: AdminUserListParams): Promise<AdminUsersResponse>;
  listComments(params?: AdminCommentListParams): Promise<AdminCommentsResponse>;
  deleteComment(commentId: string): Promise<{ comment_id: string }>;
  deletePost(postId: string): Promise<{ post_id: string }>;
}

export type AdminCommentListParams = {
  page?: number;
  limit?: number;
  post_id?: string;
};

export type AdminCommentSummary = {
  id: string;
  content: string;
  post_id: string;
  author: {
    id: string;
    name: string;
    email?: string;
  };
  parent_id: string | null;
  like_count?: number;
  reply_count?: number;
  created_at: string;
};

export type AdminCommentsResponse = {
  comments: AdminCommentSummary[];
  pagination: Pagination;
};

class ApiAdminRepository implements AdminRepository {
  async listPendingPosts(params: AdminPostListParams = {}): Promise<AdminPendingPostsResponse> {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      appendQueryParam(qs, key, value);
    }
    const url = qs.size ? `${API_ENDPOINTS.ADMIN.POSTS_PENDING}?${qs.toString()}` : API_ENDPOINTS.ADMIN.POSTS_PENDING;
    const res = await httpAuth.get<ApiResponse<AdminPendingPostsResponse>>(url);
    return unwrapApiResponse<AdminPendingPostsResponse>(res);
  }

  async listPosts(params: AdminPostListParams = {}): Promise<AdminPostsResponse> {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      appendQueryParam(qs, key, value);
    }
    const url = qs.size ? `${API_ENDPOINTS.ADMIN.POSTS}?${qs.toString()}` : API_ENDPOINTS.ADMIN.POSTS;
    const res = await httpAuth.get<ApiResponse<AdminPostsResponse>>(url);
    return unwrapApiResponse<AdminPostsResponse>(res);
  }

  async reviewPost(postId: string, input: AdminPostReviewInput): Promise<AdminPostReviewResult> {
    const path = API_ENDPOINTS.ADMIN.POST_REVIEW.replace(':postId', encodeURIComponent(postId));
    const res = await httpAuth.put<ApiResponse<AdminPostReviewResult>>(path, input);
    return unwrapApiResponse<AdminPostReviewResult>(res);
  }

  async deletePost(postId: string): Promise<{ post_id: string }> {
    const path = API_ENDPOINTS.ADMIN.POST_DELETE.replace(':postId', encodeURIComponent(postId));
    const res = await httpAuth.delete<ApiResponse<{ post_id: string }>>(path);
    return unwrapApiResponse<{ post_id: string }>(res);
  }

  async listUsers(params: AdminUserListParams = {}): Promise<AdminUsersResponse> {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      appendQueryParam(qs, key, value);
    }
    const url = qs.size ? `${API_ENDPOINTS.ADMIN.USERS}?${qs.toString()}` : API_ENDPOINTS.ADMIN.USERS;
    const res = await httpAuth.get<ApiResponse<AdminUsersResponse>>(url);
    return unwrapApiResponse<AdminUsersResponse>(res);
  }

  async listAdmins(params: AdminUserListParams = {}): Promise<AdminUsersResponse> {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      appendQueryParam(qs, key, value);
    }
    const url = qs.size ? `${API_ENDPOINTS.ADMIN.ADMINS}?${qs.toString()}` : API_ENDPOINTS.ADMIN.ADMINS;
    const res = await httpAuth.get<ApiResponse<AdminUsersResponse>>(url);
    return unwrapApiResponse<AdminUsersResponse>(res);
  }

  async listSuperAdmins(params: AdminUserListParams = {}): Promise<AdminUsersResponse> {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      appendQueryParam(qs, key, value);
    }
    const url = qs.size ? `${API_ENDPOINTS.ADMIN.SUPER_ADMINS}?${qs.toString()}` : API_ENDPOINTS.ADMIN.SUPER_ADMINS;
    const res = await httpAuth.get<ApiResponse<AdminUsersResponse>>(url);
    return unwrapApiResponse<AdminUsersResponse>(res);
  }

  async updateUserRole(userId: string, input: AdminUserRoleInput): Promise<AdminUserRoleResult> {
    const path = API_ENDPOINTS.ADMIN.USER_ROLE.replace(':userId', encodeURIComponent(userId));
    const res = await httpAuth.put<ApiResponse<AdminUserRoleResult>>(path, input);
    return unwrapApiResponse<AdminUserRoleResult>(res);
  }

  async updateUserStatus(userId: string, input: AdminUserStatusInput): Promise<AdminUserStatusResult> {
    const path = API_ENDPOINTS.ADMIN.USER_STATUS.replace(':userId', encodeURIComponent(userId));
    const res = await httpAuth.put<ApiResponse<AdminUserStatusResult>>(path, input);
    return unwrapApiResponse<AdminUserStatusResult>(res);
  }

  async listComments(params: AdminCommentListParams = {}): Promise<AdminCommentsResponse> {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      appendQueryParam(qs, key, value);
    }
    const url = qs.size ? `${API_ENDPOINTS.ADMIN.COMMENTS}?${qs.toString()}` : API_ENDPOINTS.ADMIN.COMMENTS;
    const res = await httpAuth.get<ApiResponse<AdminCommentsResponse>>(url);
    return unwrapApiResponse<AdminCommentsResponse>(res);
  }

  async deleteComment(commentId: string): Promise<{ comment_id: string }> {
    const path = API_ENDPOINTS.ADMIN.COMMENT_DELETE.replace(':commentId', encodeURIComponent(commentId));
    const res = await httpAuth.delete<ApiResponse<{ comment_id: string }>>(path);
    return unwrapApiResponse<{ comment_id: string }>(res);
  }
}

export const adminRepository: AdminRepository = new ApiAdminRepository();
