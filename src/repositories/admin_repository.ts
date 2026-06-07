import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import { API_ENDPOINTS, ROLES, USE_MOCK } from '@/src/constants/app';
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

class MockAdminRepository implements AdminRepository {
  private pendingPosts: AdminPendingPostSummary[] = Array.from({ length: 6 }).map((_, idx) => ({
    id: `pending-${idx + 1}`,
    title: `待审核帖子 ${idx + 1}`,
    content: `这是一条待审核的帖子内容示例 ${idx + 1}`,
    category: idx % 2 === 0 ? 'food' : 'recipe',
    post_type: idx % 2 === 0 ? 'share' : 'seeking',
    images: ['https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800&auto=format&fit=crop'],
    author: {
      id: `author-${idx + 1}`,
      name: `作者 ${idx + 1}`,
      email: `author${idx + 1}@example.com`,
    },
    status: 'pending',
    created_at: new Date(Date.now() - idx * 3600_000).toISOString(),
  }));

  private users: AdminUserSummary[] = [
    {
      id: 'user-1',
      name: '张三',
      email: 'zhangsan@example.com',
      avatar_url: 'https://i.pravatar.cc/150?img=1',
      role: ROLES.USER,
      is_active: true,
      stats: { post_count: 12, follower_count: 56 },
      created_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'user-2',
      name: '李四',
      email: 'lisi@example.com',
      avatar_url: 'https://i.pravatar.cc/150?img=2',
      role: ROLES.ADMIN,
      is_active: true,
      stats: { post_count: 34, follower_count: 120 },
      created_at: '2024-02-01T00:00:00Z',
    },
    {
      id: 'user-3',
      name: '王五',
      email: 'wangwu@example.com',
      avatar_url: 'https://i.pravatar.cc/150?img=3',
      role: ROLES.USER,
      is_active: false,
      stats: { post_count: 5, follower_count: 15 },
      created_at: '2024-03-01T00:00:00Z',
    },
  ];

  private comments: AdminCommentSummary[] = Array.from({ length: 10 }).map((_, idx) => ({
    id: `comment-${idx + 1}`,
    content: `这是一条待审核的评论内容 ${idx + 1}`,
    post_id: `post-${Math.floor(idx / 2) + 1}`,
    author: {
      id: `user-${idx + 1}`,
      name: `用户 ${idx + 1}`,
      email: `user${idx + 1}@example.com`,
    },
    parent_id: null,
    like_count: idx * 2,
    reply_count: idx % 3,
    created_at: new Date(Date.now() - idx * 7200_000).toISOString(),
  }));

  async listPendingPosts(params: AdminPostListParams = {}): Promise<AdminPendingPostsResponse> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const page = Math.max(1, Math.floor(params.page ?? 1));
    const limit = Math.max(1, Math.min(50, Math.floor(params.limit ?? 20)));
    const start = (page - 1) * limit;
    const posts = this.pendingPosts.slice(start, start + limit);
    return {
      posts,
      pagination: {
        page,
        limit,
        total: this.pendingPosts.length,
        total_pages: Math.max(1, Math.ceil(this.pendingPosts.length / limit)),
      },
    };
  }

  async listPosts(params: AdminPostListParams = {}): Promise<AdminPostsResponse> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const page = Math.max(1, Math.floor(params.page ?? 1));
    const limit = Math.max(1, Math.min(50, Math.floor(params.limit ?? 20)));
    let list = [...this.pendingPosts];
    if (params.status) {
      list = list.filter((post) => post.status === params.status);
    }
    if (params.post_type) {
      list = list.filter((post) => post.post_type === params.post_type);
    }
    const start = (page - 1) * limit;
    const posts = list.slice(start, start + limit);
    return {
      posts,
      pagination: {
        page,
        limit,
        total: list.length,
        total_pages: Math.max(1, Math.ceil(list.length / limit)),
      },
    };
  }

  async reviewPost(postId: string, input: AdminPostReviewInput): Promise<AdminPostReviewResult> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const index = this.pendingPosts.findIndex((post) => post.id === postId);
    if (index >= 0) {
      this.pendingPosts[index] = {
        ...this.pendingPosts[index],
        status: input.status,
      };
    }
    return {
      post_id: postId,
      status: input.status,
      reviewed_at: new Date().toISOString(),
    };
  }

  async deletePost(postId: string): Promise<{ post_id: string }> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    this.pendingPosts = this.pendingPosts.filter((post) => post.id !== postId);
    return { post_id: postId };
  }

  async listUsers(params: AdminUserListParams = {}): Promise<AdminUsersResponse> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    let list = [...this.users];
    if (typeof params.is_active === 'boolean') {
      list = list.filter((user) => user.is_active === params.is_active);
    }
    if (params.role) {
      list = list.filter((user) => user.role === params.role);
    }
    return this.paginateUsers(list, params);
  }

  async listAdmins(params: AdminUserListParams = {}): Promise<AdminUsersResponse> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const admins = this.users.filter((user) => user.role === ROLES.ADMIN);
    return this.paginateUsers(admins, params);
  }

  async listSuperAdmins(params: AdminUserListParams = {}): Promise<AdminUsersResponse> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const supers = this.users.filter((user) => user.role === ROLES.SUPER_ADMIN);
    return this.paginateUsers(supers, params);
  }

  async updateUserRole(userId: string, input: AdminUserRoleInput): Promise<AdminUserRoleResult> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const target = this.users.find((user) => user.id === userId);
    if (target) {
      target.role = input.role;
    }
    return {
      user_id: userId,
      role: input.role,
    };
  }

  async updateUserStatus(userId: string, input: AdminUserStatusInput): Promise<AdminUserStatusResult> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const target = this.users.find((user) => user.id === userId);
    if (target) {
      target.is_active = input.is_active;
    }
    return {
      user_id: userId,
      is_active: input.is_active,
    };
  }

  async listComments(params: AdminCommentListParams = {}): Promise<AdminCommentsResponse> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const page = Math.max(1, Math.floor(params.page ?? 1));
    const limit = Math.max(1, Math.min(50, Math.floor(params.limit ?? 20)));
    let list = [...this.comments];
    if (params.post_id) {
      list = list.filter((comment) => comment.post_id === params.post_id);
    }
    const start = (page - 1) * limit;
    const comments = list.slice(start, start + limit);
    return {
      comments,
      pagination: {
        page,
        limit,
        total: list.length,
        total_pages: Math.max(1, Math.ceil(list.length / limit)),
      },
    };
  }

  async deleteComment(commentId: string): Promise<{ comment_id: string }> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    this.comments = this.comments.filter((comment) => comment.id !== commentId);
    return { comment_id: commentId };
  }

  private paginateUsers(list: AdminUserSummary[], params: AdminUserListParams): AdminUsersResponse {
    const page = Math.max(1, Math.floor(params.page ?? 1));
    const limit = Math.max(1, Math.min(50, Math.floor(params.limit ?? 20)));
    const start = (page - 1) * limit;
    const users = list.slice(start, start + limit);
    return {
      users,
      pagination: {
        page,
        limit,
        total: list.length,
        total_pages: Math.max(1, Math.ceil(list.length / limit)),
      },
    };
  }
}

export const adminRepository: AdminRepository = USE_MOCK ? new MockAdminRepository() : new ApiAdminRepository();
