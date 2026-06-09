import { API_ENDPOINTS } from '@/src/constants/app';
import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import type { Post } from '@/src/models/Post';
import type { User } from '@/src/models/User';

export type SearchPostsParams = {
  q: string;
  category?: string;
  canteen?: string;
  tags?: string[];
  page?: number;
  limit?: number;
};

export type SearchUsersParams = {
  q: string;
  page?: number;
  limit?: number;
};

export type SearchHighlight = {
  title?: string;
  content?: string;
};

export type SearchPost = Post & {
  highlight?: SearchHighlight;
};

export type SearchPostsResponse = {
  posts: SearchPost[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

export type SearchUser = Omit<User, 'stats'> & {
  bio?: string;
  stats?: {
    post_count?: number;
    follower_count?: number;
    like_count?: number;
    favorite_count?: number;
  };
  is_following?: boolean;
};

export type SearchUsersResponse = {
  users: SearchUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
};

export interface SearchRepository {
  searchPosts(params: SearchPostsParams): Promise<SearchPostsResponse>;
  searchUsers(params: SearchUsersParams): Promise<SearchUsersResponse>;
}

class ApiSearchRepository implements SearchRepository {
  async searchPosts(params: SearchPostsParams): Promise<SearchPostsResponse> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value == null || value === '') return;
      if (Array.isArray(value)) {
        if (!value.length) return;
        qs.set(key, value.join(','));
      } else {
        qs.set(key, String(value));
      }
    });
    const url = `${API_ENDPOINTS.SEARCH.POSTS}${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await httpAuth.get<ApiResponse<SearchPostsResponse>>(url);
    return unwrapApiResponse<SearchPostsResponse>(res, 200);
  }

  async searchUsers(params: SearchUsersParams): Promise<SearchUsersResponse> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value == null || value === '') return;
      qs.set(key, String(value));
    });
    const url = `${API_ENDPOINTS.SEARCH.USERS}${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await httpAuth.get<ApiResponse<SearchUsersResponse>>(url);
    return unwrapApiResponse<SearchUsersResponse>(res, 200);
  }
}

export const searchRepository: SearchRepository = new ApiSearchRepository();

