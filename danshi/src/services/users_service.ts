import {
  usersRepository,
  type UpdateUserInput,
  type UserFavoriteListParams,
  type UserFavoriteListResponse,
  type UserFollowListParams,
  type UserFollowListResponse,
  type UserPostListParams,
  type UserPostListResponse,
  type UserProfile,
  type FollowActionResponse,
} from '@/src/repositories/users_repository';
import { AppError } from '@/src/lib/errors/app_error';
import { isHttpOrHttpsUrl } from '@/src/lib/security/url';

const isNonEmpty = (v?: string | null) => !!v && v.trim().length > 0;
const isValidUrl = (v?: string | null) => !v || isHttpOrHttpsUrl(v);

export const usersService = {
  async getUser(userId: string): Promise<UserProfile> {
    if (!isNonEmpty(userId)) throw new AppError('缺少用户ID');
    return usersRepository.getUser(userId);
  },

  async updateUser(userId: string, input: UpdateUserInput): Promise<UserProfile> {
    if (!isNonEmpty(userId)) throw new AppError('缺少用户ID');
    if (input.name !== undefined && !isNonEmpty(input.name)) throw new AppError('用户名不能为空');
    if (input.avatar_url !== undefined && !isValidUrl(input.avatar_url)) {
      throw new AppError('头像URL必须为 http(s) 地址');
    }
    const { user } = await usersRepository.updateUser(userId, input);
    return user;
  },

  async getUserPosts(userId: string, params: UserPostListParams = {}): Promise<UserPostListResponse> {
    if (!isNonEmpty(userId)) throw new AppError('缺少用户ID');
    const sanitized: UserPostListParams = {};
    if (params.page !== undefined) sanitized.page = Math.max(1, Math.floor(params.page));
    if (params.limit !== undefined) sanitized.limit = Math.min(50, Math.max(1, Math.floor(params.limit)));
    if (params.status) sanitized.status = params.status;
    return usersRepository.listUserPosts(userId, sanitized);
  },

  async getUserFollowing(userId: string, params: UserFollowListParams = {}): Promise<UserFollowListResponse> {
    if (!isNonEmpty(userId)) throw new AppError('缺少用户ID');
    const sanitized: UserFollowListParams = {};
    if (params.page !== undefined) sanitized.page = Math.max(1, Math.floor(params.page));
    if (params.limit !== undefined) sanitized.limit = Math.min(50, Math.max(1, Math.floor(params.limit)));
    return usersRepository.listUserFollowing(userId, sanitized);
  },

  async getUserFollowers(userId: string, params: UserFollowListParams = {}): Promise<UserFollowListResponse> {
    if (!isNonEmpty(userId)) throw new AppError('缺少用户ID');
    const sanitized: UserFollowListParams = {};
    if (params.page !== undefined) sanitized.page = Math.max(1, Math.floor(params.page));
    if (params.limit !== undefined) sanitized.limit = Math.min(50, Math.max(1, Math.floor(params.limit)));
    return usersRepository.listUserFollowers(userId, sanitized);
  },

  async getUserFavorites(userId: string, params: UserFavoriteListParams = {}): Promise<UserFavoriteListResponse> {
    if (!isNonEmpty(userId)) throw new AppError('缺少用户ID');
    const sanitized: UserFavoriteListParams = {};
    if (params.page !== undefined) sanitized.page = Math.max(1, Math.floor(params.page));
    if (params.limit !== undefined) sanitized.limit = Math.min(50, Math.max(1, Math.floor(params.limit)));
    return usersRepository.listUserFavorites(userId, sanitized);
  },

  async followUser(userId: string): Promise<FollowActionResponse> {
    if (!isNonEmpty(userId)) throw new AppError('缺少用户ID');
    return usersRepository.followUser(userId);
  },

  async unfollowUser(userId: string): Promise<FollowActionResponse> {
    if (!isNonEmpty(userId)) throw new AppError('缺少用户ID');
    return usersRepository.unfollowUser(userId);
  },
};
