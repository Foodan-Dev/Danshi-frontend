import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import type { User, Gender, UserStats } from '@/src/models/User';
import { API_ENDPOINTS } from '@/src/constants/app';

const appendQueryParam = (qs: URLSearchParams, key: string, value: unknown) => {
  if (value == null) return;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return;
    qs.set(key, trimmed);
    return;
  }
  qs.set(key, String(value));
};

export interface UserProfile extends User {
  bio?: string;
  stats: UserStats;
  is_following: boolean;
  created_at: string; // ISO
}

export type Pagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type UserPostListParams = {
  page?: number;
  limit?: number;
  status?: 'pending' | 'approved' | 'rejected' | 'draft';
};

export type UserPostListItem = {
  id: string;
  title: string;
  category?: string;
  status?: 'pending' | 'approved' | 'rejected' | 'draft';
  // 平铺格式的统计数据
  like_count?: number;
  view_count?: number;
  comment_count?: number;
  favorite_count?: number;
  // 嵌套格式的统计数据（某些 API 可能返回这种格式）
  stats?: {
    like_count?: number;
    view_count?: number;
    comment_count?: number;
    favorite_count?: number;
  };
  cover_image?: string;
  images?: string[];  // 某些 API 可能返回完整的 images 数组
  created_at?: string;
  post_type?: 'share' | 'seeking';
  share_type?: 'recommend' | 'warning';
  content?: string;
  updated_at?: string;
  tags?: string[];
  canteen?: string;
  price?: number;
  is_liked?: boolean;
  is_favorited?: boolean;
  author?: {
    id: string;
    name: string;
    avatar_url?: string;
  };
};

export type UserPostListResponse = {
  posts: UserPostListItem[];
  pagination: Pagination;
};

export type UserFollowListParams = {
  page?: number;
  limit?: number;
};

export type UserFavoriteListParams = {
  page?: number;
  limit?: number;
};

export type UserFavoriteListResponse = {
  posts: UserPostListItem[];
  pagination: Pagination;
};

export type FollowUserItem = {
  id: string;
  name: string;
  avatar_url?: string | null;
  bio?: string;
  stats?: Partial<UserStats>;
  is_following?: boolean;
};

export type UserFollowListResponse = {
  users: FollowUserItem[];
  pagination: Pagination;
};

export type FollowActionResponse = {
  is_following: boolean;
  follower_count: number;
};

export type UpdateUserInput = {
  name?: string;
  bio?: string;
  avatar_url?: string | null;
  gender?: Gender;
  hometown?: string;
};

export interface UsersRepository {
  getUser(userId: string): Promise<UserProfile>;
  updateUser(userId: string, input: UpdateUserInput): Promise<{ user: UserProfile }>;
  listUserPosts(userId: string, params?: UserPostListParams): Promise<UserPostListResponse>;
  listUserFavorites(userId: string, params?: UserFavoriteListParams): Promise<UserFavoriteListResponse>;
  listUserFollowing(userId: string, params?: UserFollowListParams): Promise<UserFollowListResponse>;
  listUserFollowers(userId: string, params?: UserFollowListParams): Promise<UserFollowListResponse>;
  followUser(userId: string): Promise<FollowActionResponse>;
  unfollowUser(userId: string): Promise<FollowActionResponse>;
}

export class ApiUsersRepository implements UsersRepository {
  async getUser(userId: string): Promise<UserProfile> {
    const url = API_ENDPOINTS.USERS.ROOT.replace(':userId', encodeURIComponent(userId));
    // 使用 httpAuth 以便后端能识别当前用户身份，正确返回 is_following 状态
    const res = await httpAuth.get<ApiResponse<UserProfile>>(url);
    return unwrapApiResponse<UserProfile>(res);
  }
  async updateUser(userId: string, input: UpdateUserInput): Promise<{ user: UserProfile }> {
    const url = API_ENDPOINTS.USERS.ROOT.replace(':userId', encodeURIComponent(userId));
    const res = await httpAuth.put<ApiResponse<{ user: UserProfile }>>(url, input);
    return unwrapApiResponse<{ user: UserProfile }>(res);
  }

  async listUserPosts(userId: string, params: UserPostListParams = {}): Promise<UserPostListResponse> {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      appendQueryParam(qs, key, value);
    }
    const path = API_ENDPOINTS.USERS.POSTS.replace(':userId', encodeURIComponent(userId));
    const url = qs.size ? `${path}?${qs.toString()}` : path;
    // 使用 httpAuth 以便后端能识别当前用户身份，正确返回 is_liked 等状态
    const res = await httpAuth.get<ApiResponse<UserPostListResponse>>(url);
    return unwrapApiResponse<UserPostListResponse>(res);
  }

  async listUserFavorites(userId: string, params: UserFavoriteListParams = {}): Promise<UserFavoriteListResponse> {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      appendQueryParam(qs, key, value);
    }
    const path = API_ENDPOINTS.USERS.FAVORITES.replace(':userId', encodeURIComponent(userId));
    const url = qs.size ? `${path}?${qs.toString()}` : path;
    const res = await httpAuth.get<ApiResponse<UserFavoriteListResponse>>(url);
    return unwrapApiResponse<UserFavoriteListResponse>(res);
  }

  async listUserFollowing(userId: string, params: UserFollowListParams = {}): Promise<UserFollowListResponse> {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      appendQueryParam(qs, key, value);
    }
    const path = API_ENDPOINTS.USERS.FOLLOWING.replace(':userId', encodeURIComponent(userId));
    const url = qs.size ? `${path}?${qs.toString()}` : path;
    const res = await httpAuth.get<ApiResponse<UserFollowListResponse>>(url);
    return unwrapApiResponse<UserFollowListResponse>(res);
  }

  async listUserFollowers(userId: string, params: UserFollowListParams = {}): Promise<UserFollowListResponse> {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      appendQueryParam(qs, key, value);
    }
    const path = API_ENDPOINTS.USERS.FOLLOWERS.replace(':userId', encodeURIComponent(userId));
    const url = qs.size ? `${path}?${qs.toString()}` : path;
    const res = await httpAuth.get<ApiResponse<UserFollowListResponse>>(url);
    return unwrapApiResponse<UserFollowListResponse>(res);
  }

  async followUser(userId: string): Promise<FollowActionResponse> {
    const path = API_ENDPOINTS.USERS.FOLLOW.replace(':userId', encodeURIComponent(userId));
    const res = await httpAuth.post<ApiResponse<FollowActionResponse>>(path, {});
    return unwrapApiResponse<FollowActionResponse>(res);
  }

  async unfollowUser(userId: string): Promise<FollowActionResponse> {
    const path = API_ENDPOINTS.USERS.FOLLOW.replace(':userId', encodeURIComponent(userId));
    const res = await httpAuth.delete<ApiResponse<FollowActionResponse>>(path);
    return unwrapApiResponse<FollowActionResponse>(res);
  }
}

export const usersRepository: UsersRepository = new ApiUsersRepository();
