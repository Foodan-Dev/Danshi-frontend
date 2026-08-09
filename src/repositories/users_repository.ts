import { http } from '@/src/lib/http/client';
import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import type { User, Gender, UserStats } from '@/src/models/User';
import { API_ENDPOINTS, USE_MOCK } from '@/src/constants/app';

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

export class MockUsersRepository implements UsersRepository {
  private store: Record<string, UserProfile> = {
    '1234567890': {
      id: '1234567890',
      email: 'knd@example.com',
      name: 'knd',
      gender: 'male',
      hometown: 'Shanghai',
      role: 'user',
      avatar_url: 'https://i.pravatar.cc/150?img=11',
      bio: '热爱美食的复旦学子 🍜',
      stats: { post_count: 15, like_count: 128, favorite_count: 45, follower_count: 230, following_count: 85 },
      is_following: false,
      created_at: '2024-01-01T00:00:00Z',
    },
    'user-1': {
      id: 'user-1',
      email: 'zhangsan@example.com',
      name: '张三',
      gender: 'male',
      hometown: 'Beijing',
      role: 'user',
      avatar_url: 'https://i.pravatar.cc/150?img=1',
      bio: '北区食堂美食探索者 🔍 | 爱好川菜和粤菜',
      stats: { post_count: 28, like_count: 256, favorite_count: 89, follower_count: 456, following_count: 123 },
      is_following: false,
      created_at: '2024-02-15T08:30:00Z',
    },
    'user-2': {
      id: 'user-2',
      email: 'lisi@example.com',
      name: '李四',
      gender: 'female',
      hometown: 'Hangzhou',
      role: 'admin',
      avatar_url: 'https://i.pravatar.cc/150?img=2',
      bio: '美食博主 | 擅长烘焙和甜点制作 🍰',
      stats: { post_count: 42, like_count: 512, favorite_count: 156, follower_count: 892, following_count: 234 },
      is_following: true,
      created_at: '2024-01-20T10:15:00Z',
    },
    'user-3': {
      id: 'user-3',
      email: 'wangwu@example.com',
      name: '王五',
      gender: 'male',
      hometown: 'Guangzhou',
      role: 'user',
      avatar_url: 'https://i.pravatar.cc/150?img=3',
      bio: '南区食堂常客 | 喜欢尝试各种新菜',
      stats: { post_count: 12, like_count: 98, favorite_count: 34, follower_count: 178, following_count: 67 },
      is_following: false,
      created_at: '2024-03-05T14:20:00Z',
    },
    'user-4': {
      id: 'user-4',
      email: 'zhaoliu@example.com',
      name: '赵六',
      gender: 'female',
      hometown: 'Chengdu',
      role: 'user',
      avatar_url: 'https://i.pravatar.cc/150?img=4',
      bio: '辣妹子 🌶️ | 寻找最正宗的川菜',
      stats: { post_count: 35, like_count: 387, favorite_count: 145, follower_count: 621, following_count: 189 },
      is_following: true,
      created_at: '2024-02-28T16:45:00Z',
    },
    'user-5': {
      id: 'user-5',
      email: 'sunqi@example.com',
      name: '孙七',
      gender: 'male',
      hometown: 'Nanjing',
      role: 'user',
      avatar_url: 'https://i.pravatar.cc/150?img=5',
      bio: '食堂避雷小能手 ⚠️',
      stats: { post_count: 19, like_count: 167, favorite_count: 56, follower_count: 312, following_count: 98 },
      is_following: false,
      created_at: '2024-03-12T09:30:00Z',
    },
    'user-6': {
      id: 'user-6',
      email: 'zhouba@example.com',
      name: '周八',
      gender: 'female',
      hometown: 'Suzhou',
      role: 'user',
      avatar_url: 'https://i.pravatar.cc/150?img=6',
      bio: '甜品爱好者 🧁 | 奶茶重度依赖患者',
      stats: { post_count: 31, like_count: 289, favorite_count: 112, follower_count: 534, following_count: 167 },
      is_following: false,
      created_at: '2024-01-25T11:20:00Z',
    },
    'user-7': {
      id: 'user-7',
      email: 'wujiu@example.com',
      name: '吴九',
      gender: 'male',
      hometown: 'Xi\'an',
      role: 'user',
      avatar_url: 'https://i.pravatar.cc/150?img=7',
      bio: '面食爱好者 🍜 | 西北菜推广大使',
      stats: { post_count: 24, like_count: 213, favorite_count: 78, follower_count: 389, following_count: 134 },
      is_following: true,
      created_at: '2024-02-10T13:40:00Z',
    },
    'user-8': {
      id: 'user-8',
      email: 'zhengshi@example.com',
      name: '郑十',
      gender: 'female',
      hometown: 'Shenzhen',
      role: 'user',
      avatar_url: 'https://i.pravatar.cc/150?img=8',
      bio: '健身达人 💪 | 寻找低卡高蛋白美食',
      stats: { post_count: 27, like_count: 245, favorite_count: 91, follower_count: 467, following_count: 156 },
      is_following: false,
      created_at: '2024-03-01T15:50:00Z',
    },
  };
  private favoritesStore: Record<string, UserPostListItem[]> = {
    '1234567890': Array.from({ length: 5 }).map((_, idx) => ({
      id: `favorite-post-knd-${idx + 1}`,
      title: `收藏帖子 ${idx + 1}`,
      category: idx % 2 === 0 ? 'food' : 'recipe',
      status: 'approved',
      like_count: 35 + idx * 2,
      view_count: 200 + idx * 20,
      comment_count: 5 + idx,
      cover_image: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?w=640&auto=format&fit=crop',
      created_at: new Date(Date.now() - idx * 172800000).toISOString(),
    })),
    'user-1': Array.from({ length: 8 }).map((_, idx) => ({
      id: `favorite-post-user1-${idx + 1}`,
      title: `北区美食推荐 ${idx + 1}`,
      category: 'food',
      status: 'approved',
      like_count: 42 + idx * 3,
      view_count: 280 + idx * 25,
      comment_count: 8 + idx,
      cover_image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=640&auto=format&fit=crop',
      created_at: new Date(Date.now() - idx * 259200000).toISOString(),
    })),
    'user-2': Array.from({ length: 12 }).map((_, idx) => ({
      id: `favorite-post-user2-${idx + 1}`,
      title: `甜品制作教程 ${idx + 1}`,
      category: 'recipe',
      status: 'approved',
      like_count: 56 + idx * 4,
      view_count: 320 + idx * 30,
      comment_count: 12 + idx,
      cover_image: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=640&auto=format&fit=crop',
      created_at: new Date(Date.now() - idx * 345600000).toISOString(),
    })),
    'user-4': Array.from({ length: 10 }).map((_, idx) => ({
      id: `favorite-post-user4-${idx + 1}`,
      title: `辣味美食探店 ${idx + 1}`,
      category: 'food',
      status: 'approved',
      like_count: 48 + idx * 3,
      view_count: 295 + idx * 28,
      comment_count: 9 + idx,
      cover_image: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=640&auto=format&fit=crop',
      created_at: new Date(Date.now() - idx * 302400000).toISOString(),
    })),
  };
  private postsStore: Record<string, UserPostListItem[]> = {
    '1234567890': Array.from({ length: 8 }).map((_, idx) => {
      const images = [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=640&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=640&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=640&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=640&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=640&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1482049016gy-g9ce01bac27e?w=640&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=640&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=640&auto=format&fit=crop',
      ];
      return {
        id: `mock-post-knd-${idx + 1}`,
        title: `南区食堂美食分享 ${idx + 1}`,
        category: idx % 2 === 0 ? 'food' : 'recipe',
        status: 'approved',
        like_count: 20 + idx * 3,
        view_count: 120 + idx * 15,
        comment_count: 4 + idx,
        cover_image: images[idx % images.length],
        created_at: new Date(Date.now() - idx * 86400000).toISOString(),
      };
    }),
    'user-1': Array.from({ length: 15 }).map((_, idx) => ({
      id: `post-user1-${idx + 1}`,
      title: idx % 3 === 0 ? `北区川菜窗口推荐 ${idx + 1}` : idx % 3 === 1 ? `粤菜小炒测评 ${idx + 1}` : `食堂避雷指南 ${idx + 1}`,
      category: idx % 2 === 0 ? 'food' : 'recipe',
      status: 'approved',
      like_count: 28 + idx * 4,
      view_count: 165 + idx * 18,
      comment_count: 6 + idx,
      cover_image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=640&auto=format&fit=crop',
      created_at: new Date(Date.now() - idx * 129600000).toISOString(),
    })),
    'user-2': Array.from({ length: 20 }).map((_, idx) => ({
      id: `post-user2-${idx + 1}`,
      title: idx % 2 === 0 ? `烘焙日记：${['提拉米苏', '芝士蛋糕', '马卡龙', '泡芙'][idx % 4]} 制作` : `甜品店探店：${['星巴克', '奈雪的茶', '喜茶', '瑞幸'][idx % 4]}`,
      category: idx % 3 === 0 ? 'recipe' : 'food',
      status: 'approved',
      like_count: 45 + idx * 5,
      view_count: 220 + idx * 22,
      comment_count: 10 + idx,
      cover_image: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?w=640&auto=format&fit=crop',
      created_at: new Date(Date.now() - idx * 172800000).toISOString(),
    })),
    'user-3': Array.from({ length: 6 }).map((_, idx) => ({
      id: `post-user3-${idx + 1}`,
      title: `南区食堂新菜尝鲜 ${idx + 1}`,
      category: 'food',
      status: 'approved',
      like_count: 18 + idx * 2,
      view_count: 95 + idx * 12,
      comment_count: 3 + idx,
      cover_image: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=640&auto=format&fit=crop',
      created_at: new Date(Date.now() - idx * 259200000).toISOString(),
    })),
    'user-4': Array.from({ length: 18 }).map((_, idx) => ({
      id: `post-user4-${idx + 1}`,
      title: idx % 2 === 0 ? `辣味美食探店 ${idx + 1}` : `川菜家常菜谱 ${idx + 1}`,
      category: idx % 3 === 0 ? 'recipe' : 'food',
      status: 'approved',
      like_count: 38 + idx * 4,
      view_count: 195 + idx * 20,
      comment_count: 8 + idx,
      cover_image: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?w=640&auto=format&fit=crop',
      created_at: new Date(Date.now() - idx * 216000000).toISOString(),
    })),
    'user-5': Array.from({ length: 10 }).map((_, idx) => ({
      id: `post-user5-${idx + 1}`,
      title: `食堂避雷测评 ${idx + 1}`,
      category: 'food',
      status: 'approved',
      like_count: 22 + idx * 3,
      view_count: 132 + idx * 16,
      comment_count: 5 + idx,
      cover_image: 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=640&auto=format&fit=crop',
      created_at: new Date(Date.now() - idx * 302400000).toISOString(),
    })),
    'user-7': Array.from({ length: 12 }).map((_, idx) => ({
      id: `post-user7-${idx + 1}`,
      title: idx % 2 === 0 ? `西北面食大全 ${idx + 1}` : `食堂面档推荐 ${idx + 1}`,
      category: idx % 3 === 0 ? 'recipe' : 'food',
      status: 'approved',
      like_count: 31 + idx * 3,
      view_count: 178 + idx * 19,
      comment_count: 7 + idx,
      cover_image: 'https://images.unsplash.com/photo-1555126634-323283e090fa?w=640&auto=format&fit=crop',
      created_at: new Date(Date.now() - idx * 345600000).toISOString(),
    })),
  };
  private followingStore: Record<string, FollowUserItem[]> = {
    '1234567890': [
      { id: 'user-2', name: '李四', avatar_url: 'https://i.pravatar.cc/150?img=2', bio: '美食博主 | 擅长烘焙和甜点制作 🍰', stats: { post_count: 42, follower_count: 892 }, is_following: true },
      { id: 'user-4', name: '赵六', avatar_url: 'https://i.pravatar.cc/150?img=4', bio: '辣妹子 🌶️ | 寻找最正宗的川菜', stats: { post_count: 35, follower_count: 621 }, is_following: true },
      { id: 'user-7', name: '吴九', avatar_url: 'https://i.pravatar.cc/150?img=7', bio: '面食爱好者 🍜 | 西北菜推广大使', stats: { post_count: 24, follower_count: 389 }, is_following: true },
      { id: 'user-1', name: '张三', avatar_url: 'https://i.pravatar.cc/150?img=1', bio: '北区食堂美食探索者 🔍 | 爱好川菜和粤菜', stats: { post_count: 28, follower_count: 456 }, is_following: true },
      { id: 'user-6', name: '周八', avatar_url: 'https://i.pravatar.cc/150?img=6', bio: '甜品爱好者 🧁 | 奶茶重度依赖患者', stats: { post_count: 31, follower_count: 534 }, is_following: true },
    ],
    'user-1': [
      { id: 'user-4', name: '赵六', avatar_url: 'https://i.pravatar.cc/150?img=4', bio: '辣妹子 🌶️', stats: { post_count: 35, follower_count: 621 }, is_following: true },
      { id: 'user-7', name: '吴九', avatar_url: 'https://i.pravatar.cc/150?img=7', bio: '面食爱好者 🍜', stats: { post_count: 24, follower_count: 389 }, is_following: true },
      { id: 'user-3', name: '王五', avatar_url: 'https://i.pravatar.cc/150?img=3', stats: { post_count: 12, follower_count: 178 }, is_following: true },
    ],
    'user-2': [
      { id: 'user-6', name: '周八', avatar_url: 'https://i.pravatar.cc/150?img=6', bio: '甜品爱好者 🧁', stats: { post_count: 31, follower_count: 534 }, is_following: true },
      { id: 'user-8', name: '郑十', avatar_url: 'https://i.pravatar.cc/150?img=8', bio: '健身达人 💪', stats: { post_count: 27, follower_count: 467 }, is_following: true },
      { id: '1234567890', name: 'knd', avatar_url: 'https://i.pravatar.cc/150?img=11', stats: { post_count: 15, follower_count: 230 }, is_following: true },
      { id: 'user-4', name: '赵六', avatar_url: 'https://i.pravatar.cc/150?img=4', stats: { post_count: 35, follower_count: 621 }, is_following: true },
    ],
    'user-4': [
      { id: 'user-1', name: '张三', avatar_url: 'https://i.pravatar.cc/150?img=1', stats: { post_count: 28, follower_count: 456 }, is_following: true },
      { id: 'user-7', name: '吴九', avatar_url: 'https://i.pravatar.cc/150?img=7', stats: { post_count: 24, follower_count: 389 }, is_following: true },
      { id: 'user-2', name: '李四', avatar_url: 'https://i.pravatar.cc/150?img=2', stats: { post_count: 42, follower_count: 892 }, is_following: true },
    ],
  };
  private followersStore: Record<string, FollowUserItem[]> = {
    '1234567890': [
      { id: 'user-1', name: '张三', avatar_url: 'https://i.pravatar.cc/150?img=1', bio: '北区食堂美食探索者 🔍', stats: { post_count: 28, follower_count: 456 }, is_following: true },
      { id: 'user-3', name: '王五', avatar_url: 'https://i.pravatar.cc/150?img=3', bio: '南区食堂常客', stats: { post_count: 12, follower_count: 178 }, is_following: false },
      { id: 'user-5', name: '孙七', avatar_url: 'https://i.pravatar.cc/150?img=5', bio: '食堂避雷小能手 ⚠️', stats: { post_count: 19, follower_count: 312 }, is_following: false },
      { id: 'user-2', name: '李四', avatar_url: 'https://i.pravatar.cc/150?img=2', bio: '美食博主', stats: { post_count: 42, follower_count: 892 }, is_following: true },
      { id: 'user-8', name: '郑十', avatar_url: 'https://i.pravatar.cc/150?img=8', bio: '健身达人 💪', stats: { post_count: 27, follower_count: 467 }, is_following: false },
      { id: 'user-6', name: '周八', avatar_url: 'https://i.pravatar.cc/150?img=6', stats: { post_count: 31, follower_count: 534 }, is_following: true },
    ],
    'user-1': [
      { id: '1234567890', name: 'knd', avatar_url: 'https://i.pravatar.cc/150?img=11', stats: { post_count: 15, follower_count: 230 }, is_following: false },
      { id: 'user-2', name: '李四', avatar_url: 'https://i.pravatar.cc/150?img=2', stats: { post_count: 42, follower_count: 892 }, is_following: true },
      { id: 'user-5', name: '孙七', avatar_url: 'https://i.pravatar.cc/150?img=5', stats: { post_count: 19, follower_count: 312 }, is_following: false },
      { id: 'user-3', name: '王五', avatar_url: 'https://i.pravatar.cc/150?img=3', stats: { post_count: 12, follower_count: 178 }, is_following: true },
    ],
    'user-2': [
      { id: 'user-1', name: '张三', avatar_url: 'https://i.pravatar.cc/150?img=1', stats: { post_count: 28, follower_count: 456 }, is_following: false },
      { id: '1234567890', name: 'knd', avatar_url: 'https://i.pravatar.cc/150?img=11', stats: { post_count: 15, follower_count: 230 }, is_following: true },
      { id: 'user-3', name: '王五', avatar_url: 'https://i.pravatar.cc/150?img=3', stats: { post_count: 12, follower_count: 178 }, is_following: false },
      { id: 'user-4', name: '赵六', avatar_url: 'https://i.pravatar.cc/150?img=4', stats: { post_count: 35, follower_count: 621 }, is_following: true },
      { id: 'user-6', name: '周八', avatar_url: 'https://i.pravatar.cc/150?img=6', stats: { post_count: 31, follower_count: 534 }, is_following: true },
      { id: 'user-7', name: '吴九', avatar_url: 'https://i.pravatar.cc/150?img=7', stats: { post_count: 24, follower_count: 389 }, is_following: false },
      { id: 'user-8', name: '郑十', avatar_url: 'https://i.pravatar.cc/150?img=8', stats: { post_count: 27, follower_count: 467 }, is_following: true },
    ],
    'user-4': [
      { id: '1234567890', name: 'knd', avatar_url: 'https://i.pravatar.cc/150?img=11', stats: { post_count: 15, follower_count: 230 }, is_following: true },
      { id: 'user-1', name: '张三', avatar_url: 'https://i.pravatar.cc/150?img=1', stats: { post_count: 28, follower_count: 456 }, is_following: true },
      { id: 'user-2', name: '李四', avatar_url: 'https://i.pravatar.cc/150?img=2', stats: { post_count: 42, follower_count: 892 }, is_following: true },
      { id: 'user-3', name: '王五', avatar_url: 'https://i.pravatar.cc/150?img=3', stats: { post_count: 12, follower_count: 178 }, is_following: false },
      { id: 'user-5', name: '孙七', avatar_url: 'https://i.pravatar.cc/150?img=5', stats: { post_count: 19, follower_count: 312 }, is_following: false },
    ],
  };

  // Generate a default avatar URL based on a seed string
  private computeAvatar(seed: string) {
    const s = seed?.trim() || 'guest';
    return `https://api.dicebear.com/7.x/identicon/png?seed=${encodeURIComponent(s)}`;
  }

  async getUser(userId: string): Promise<UserProfile> {
    await new Promise((r) => setTimeout(r, 200));
    const user = this.store[userId];
    if (!user) throw new Error('用户不存在');
    // ensure avatar
    const seed = user.email || user.name;
    const avatar = user.avatar_url ?? this.computeAvatar(seed);
    const updated = { ...user, avatar_url: avatar };
    this.store[userId] = updated;
    return updated;
  }

  async updateUser(userId: string, input: UpdateUserInput): Promise<{ user: UserProfile }> {
    await new Promise((r) => setTimeout(r, 300));
    const user = this.store[userId];
    if (!user) throw new Error('用户不存在');
    const next: UserProfile = {
      ...user,
      ...input,
      avatar_url: input.avatar_url === undefined ? user.avatar_url : input.avatar_url,
    };
    // ensure avatar if nullish
    const seed = next.email || next.name;
    next.avatar_url = next.avatar_url ?? this.computeAvatar(seed);
    this.store[userId] = next;
    return { user: next };
  }

  private paginate<T>(items: T[], params: { page?: number; limit?: number } = {}): { data: T[]; pagination: Pagination } {
    const page = Math.max(1, Math.floor(params.page ?? 1));
    const limit = Math.max(1, Math.min(50, Math.floor(params.limit ?? 20)));
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const data = items.slice(start, start + limit);
    return {
      data,
      pagination: { page, limit, total, total_pages: totalPages },
    };
  }

  async listUserPosts(userId: string, params: UserPostListParams = {}): Promise<UserPostListResponse> {
    await new Promise((r) => setTimeout(r, 200));
    const items = this.postsStore[userId] ?? [];
    const { data, pagination } = this.paginate(items, params);
    return { posts: data, pagination };
  }

  async listUserFavorites(userId: string, params: UserFavoriteListParams = {}): Promise<UserFavoriteListResponse> {
    await new Promise((r) => setTimeout(r, 200));
    const items = this.favoritesStore[userId] ?? [];
    const { data, pagination } = this.paginate(items, params);
    return { posts: data, pagination };
  }

  async listUserFollowing(userId: string, params: UserFollowListParams = {}): Promise<UserFollowListResponse> {
    await new Promise((r) => setTimeout(r, 200));
    const items = this.followingStore[userId] ?? [];
    const { data, pagination } = this.paginate(items, params);
    return { users: data, pagination };
  }

  async listUserFollowers(userId: string, params: UserFollowListParams = {}): Promise<UserFollowListResponse> {
    await new Promise((r) => setTimeout(r, 200));
    const items = this.followersStore[userId] ?? [];
    const { data, pagination } = this.paginate(items, params);
    return { users: data, pagination };
  }

  async followUser(userId: string): Promise<FollowActionResponse> {
    await new Promise((r) => setTimeout(r, 150));
    const profile = this.store[userId];
    if (!profile) throw new Error('用户不存在');
    if (!profile.is_following) {
      profile.is_following = true;
      profile.stats.follower_count += 1;
    }
    this.store[userId] = { ...profile };
    return { is_following: profile.is_following, follower_count: profile.stats.follower_count };
  }

  async unfollowUser(userId: string): Promise<FollowActionResponse> {
    await new Promise((r) => setTimeout(r, 150));
    const profile = this.store[userId];
    if (!profile) throw new Error('用户不存在');
    if (profile.is_following) {
      profile.is_following = false;
      profile.stats.follower_count = Math.max(0, profile.stats.follower_count - 1);
    }
    this.store[userId] = { ...profile };
    return { is_following: profile.is_following, follower_count: profile.stats.follower_count };
  }
}

export const usersRepository: UsersRepository = USE_MOCK ? new MockUsersRepository() : new ApiUsersRepository();


