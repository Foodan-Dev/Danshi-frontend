import { AppError } from '@/src/lib/errors/app_error';
import {
  searchRepository,
  type SearchPostsParams,
  type SearchUsersParams,
  type SearchPostsResponse,
  type SearchUsersResponse,
  type SearchPost,
  type SearchUser,
} from '@/src/repositories/search_repository';

function normalizePageable<T extends { page?: number; limit?: number }>(params: T): T {
  const page = params.page && params.page > 0 ? Math.floor(params.page) : undefined;
  const limit = params.limit && params.limit > 0 ? Math.floor(params.limit) : undefined;
  return {
    ...params,
    ...(page ? { page } : {}),
    ...(limit ? { limit } : {}),
  } as T;
}

function sanitizeTags(tags?: string[]): string[] | undefined {
  if (!tags) return undefined;
  const unique = Array.from(new Set(tags.map((item) => item.trim()).filter(Boolean)));
  return unique.length ? unique : undefined;
}

export const searchService = {
  async searchPosts(params: SearchPostsParams): Promise<SearchPostsResponse> {
    const keyword = params.q?.trim();
    if (!keyword) throw new AppError('请输入搜索关键词');

    const normalized: SearchPostsParams = {
      ...normalizePageable(params),
      q: keyword,
      category: params.category?.trim() || undefined,
      canteen: params.canteen?.trim() || undefined,
      tags: sanitizeTags(params.tags),
    };

    return searchRepository.searchPosts(normalized);
  },

  async searchUsers(params: SearchUsersParams): Promise<SearchUsersResponse> {
    const keyword = params.q?.trim();
    if (!keyword) throw new AppError('请输入搜索关键词');
    const normalized: SearchUsersParams = {
      ...normalizePageable(params),
      q: keyword,
    };
    return searchRepository.searchUsers(normalized);
  },
};

export type { SearchPost, SearchUser, SearchPostsResponse, SearchUsersResponse };
