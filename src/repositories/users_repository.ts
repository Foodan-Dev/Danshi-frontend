import type { components } from '@/src/generated/openapi';
import { AppError } from '@/src/lib/errors/app_error';
import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import type { User, Gender, UserStats } from '@/src/models/User';
import type { Post } from '@/src/models/Post';
import { API_ENDPOINTS } from '@/src/constants/app';
import {
  requireNumber,
  requireString,
  toCursorPagination,
  toNullableNickname,
  toPagination,
  toPost,
  type CursorPagination,
} from '@/src/repositories/api_mappers';
import { normalizeRoles, primaryRole } from '@/src/lib/auth/roles';

const appendQueryParam = (qs: URLSearchParams, key: string, value: unknown) => {
  if (value == null) return;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed) qs.set(key, trimmed);
    return;
  }
  qs.set(key, String(value));
};

export type UserProfile = Omit<User, 'email' | 'role' | 'roles' | 'stats' | 'created_at'> & {
  email?: string | null;
  role?: User['role'] | null;
  roles: User['roles'];
  stats: UserStats;
  is_following: boolean;
  created_at: string;
};

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

export type UserPostListItem = Post;
export type UserPostListResponse = { posts: UserPostListItem[]; pagination: Pagination };
export type UserFavoriteListParams = { page?: number; limit?: number };
export type UserFavoriteListResponse = UserPostListResponse;
export type UserFollowListParams = { cursor?: string; limit?: number };

export type FollowUserItem = {
  id: number;
  name: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  stats?: Partial<UserStats>;
  is_following?: boolean;
};

export type UserFollowListResponse = { users: FollowUserItem[]; pagination: CursorPagination };
export type FollowActionResponse = { is_following: boolean; follower_count: number };

export type UpdateUserInput = {
  name?: string;
  bio?: string | null;
  avatar_url?: string | null;
  gender?: Gender | null;
};

const toUserStats = (stats: components['schemas']['UserStats'] | undefined): UserStats => ({
  post_count: stats?.post_count ?? 0,
  like_count: stats?.like_count ?? 0,
  favorite_count: stats?.favorite_count ?? 0,
  follower_count: stats?.follower_count ?? 0,
  following_count: stats?.following_count ?? 0,
});

const toUserProfile = (profile: components['schemas']['UserProfile']): UserProfile => {
  const roles = normalizeRoles(profile.roles);
  const gender = profile.gender === 'male' || profile.gender === 'female' || profile.gender === 'other'
    ? profile.gender
    : null;
  return {
    id: requireNumber(profile.id, '用户 ID'),
    name: toNullableNickname(profile.name),
    email: profile.email ?? null,
    role: primaryRole(roles),
    roles,
    gender,
    avatar_url: profile.avatar_url ?? null,
    bio: profile.bio ?? null,
    stats: toUserStats(profile.stats),
    is_following: profile.is_following ?? false,
    created_at: requireString(profile.created_at, '用户创建时间'),
  };
};

const toFollowUser = (user: components['schemas']['UserListItem']): FollowUserItem => ({
  id: requireNumber(user.id, '用户 ID'),
  name: toNullableNickname(user.name),
  avatar_url: user.avatar_url ?? null,
  bio: user.bio ?? null,
  stats: toUserStats(user.stats),
  is_following: user.is_following ?? false,
});

export interface UsersRepository {
  getUser(userId: number): Promise<UserProfile>;
  updateUser(userId: number, input: UpdateUserInput): Promise<{ user: UserProfile }>;
  listUserPosts(userId: number, params?: UserPostListParams): Promise<UserPostListResponse>;
  listUserFavorites(userId: number, params?: UserFavoriteListParams): Promise<UserFavoriteListResponse>;
  listUserFollowing(userId: number, params?: UserFollowListParams): Promise<UserFollowListResponse>;
  listUserFollowers(userId: number, params?: UserFollowListParams): Promise<UserFollowListResponse>;
  followUser(userId: number): Promise<FollowActionResponse>;
  unfollowUser(userId: number): Promise<FollowActionResponse>;
}

export class ApiUsersRepository implements UsersRepository {
  async getUser(userId: number): Promise<UserProfile> {
    const url = API_ENDPOINTS.USERS.ROOT.replace(':userId', encodeURIComponent(String(userId)));
    const res = await httpAuth.get<ApiResponse<components['schemas']['UserProfile']>>(url);
    return toUserProfile(unwrapApiResponse(res));
  }

  async updateUser(userId: number, input: UpdateUserInput): Promise<{ user: UserProfile }> {
    const url = API_ENDPOINTS.USERS.ROOT.replace(':userId', encodeURIComponent(String(userId)));
    const res = await httpAuth.put<ApiResponse<components['schemas']['UserUpdateResult']>>(
      url,
      input satisfies components['schemas']['updateUserRequest'],
    );
    const user = unwrapApiResponse(res).user;
    if (!user) throw new AppError('服务端响应缺少用户信息');
    return { user: toUserProfile(user) };
  }

  async listUserPosts(userId: number, params: UserPostListParams = {}): Promise<UserPostListResponse> {
    return this.listPosts(API_ENDPOINTS.USERS.POSTS, userId, params);
  }

  async listUserFavorites(userId: number, params: UserFavoriteListParams = {}): Promise<UserFavoriteListResponse> {
    return this.listPosts(API_ENDPOINTS.USERS.FAVORITES, userId, params);
  }

  private async listPosts(
    endpoint: string,
    userId: number,
    params: UserPostListParams | UserFavoriteListParams,
  ): Promise<UserPostListResponse> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => appendQueryParam(qs, key, value));
    const path = endpoint.replace(':userId', encodeURIComponent(String(userId)));
    const res = await httpAuth.get<ApiResponse<components['schemas']['PostList']>>(
      qs.size ? `${path}?${qs.toString()}` : path,
    );
    const data = unwrapApiResponse(res);
    return {
      posts: (data.posts ?? []).map(toPost),
      pagination: toPagination(data.pagination),
    };
  }

  async listUserFollowing(userId: number, params: UserFollowListParams = {}): Promise<UserFollowListResponse> {
    return this.listFollows(API_ENDPOINTS.USERS.FOLLOWING, userId, params);
  }

  async listUserFollowers(userId: number, params: UserFollowListParams = {}): Promise<UserFollowListResponse> {
    return this.listFollows(API_ENDPOINTS.USERS.FOLLOWERS, userId, params);
  }

  private async listFollows(
    endpoint: string,
    userId: number,
    params: UserFollowListParams,
  ): Promise<UserFollowListResponse> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => appendQueryParam(qs, key, value));
    const path = endpoint.replace(':userId', encodeURIComponent(String(userId)));
    const res = await httpAuth.get<ApiResponse<components['schemas']['UserFollowList']>>(
      qs.size ? `${path}?${qs.toString()}` : path,
    );
    const data = unwrapApiResponse(res);
    return {
      users: (data.users ?? []).map(toFollowUser),
      pagination: toCursorPagination(data.pagination),
    };
  }

  async followUser(userId: number): Promise<FollowActionResponse> {
    return this.setFollow(userId, true);
  }

  async unfollowUser(userId: number): Promise<FollowActionResponse> {
    return this.setFollow(userId, false);
  }

  private async setFollow(userId: number, follow: boolean): Promise<FollowActionResponse> {
    const path = API_ENDPOINTS.USERS.FOLLOW.replace(':userId', encodeURIComponent(String(userId)));
    const res = follow
      ? await httpAuth.post<ApiResponse<components['schemas']['FollowActionResult']>>(path, {})
      : await httpAuth.delete<ApiResponse<components['schemas']['FollowActionResult']>>(path);
    const data = unwrapApiResponse(res);
    return {
      is_following: data.is_following ?? false,
      follower_count: Math.max(0, data.follower_count ?? 0),
    };
  }
}

export const usersRepository: UsersRepository = new ApiUsersRepository();
