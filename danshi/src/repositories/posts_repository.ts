import { USE_MOCK, API_ENDPOINTS } from '@/src/constants/app';
import { unwrapApiResponse } from '@/src/lib/http/response';
import { httpAuth } from '@/src/lib/http/http_auth';
import type {
  Post,
  PostCreateInput,
  PostCreateResult,
  PostAuthor,
  CompanionStatusUpdateRequest,
  PostStats,
} from '@/src/models/Post';

type PostApiShape = Post & Partial<PostStats>;
type PostLikeApiResult = {
  is_liked?: boolean;
  isLiked?: boolean;
  like_count?: number;
  likeCount?: number;
};

type PostLikeResult = { is_liked: boolean; like_count: number };

const normalizePostLikeResult = (result: PostLikeApiResult): PostLikeResult => {
  const isLiked = result.is_liked ?? result.isLiked ?? false;
  const likeCount = result.like_count ?? result.likeCount ?? 0;
  return { is_liked: isLiked, like_count: Math.max(0, likeCount) };
};

const normalizePost = (post: PostApiShape): Post => {
  const isLiked = post.is_liked ?? false;
  const likeCount = post.stats?.like_count ?? post.like_count ?? 0;
  return {
    ...post,
    stats: {
      ...(post.stats ?? {}),
      like_count: isLiked ? Math.max(1, likeCount) : Math.max(0, likeCount),
      favorite_count: post.stats?.favorite_count ?? post.favorite_count ?? 0,
      comment_count: post.stats?.comment_count ?? post.comment_count ?? 0,
      view_count: post.stats?.view_count ?? post.view_count ?? 0,
    },
    is_liked: isLiked,
    is_favorited: post.is_favorited ?? false,
  };
};

export interface PostsRepository {
  create(input: PostCreateInput): Promise<PostCreateResult>;
  list(filters?: PostListFilters): Promise<PostsListResponse>;
  get(postId: string): Promise<Post>;
  update(postId: string, input: PostCreateInput): Promise<{ id: string; status: 'pending' | 'approved' | 'rejected' }>;
  delete(postId: string): Promise<void>;
  like(postId: string): Promise<PostLikeResult>;
  unlike(postId: string): Promise<PostLikeResult>;
  favorite(postId: string): Promise<{ is_favorited: boolean; favorite_count: number }>;
  unfavorite(postId: string): Promise<{ is_favorited: boolean; favorite_count: number }>;
  updateCompanionStatus(postId: string, input: CompanionStatusUpdateRequest): Promise<void>;
}

export type SortBy = 'latest' | 'hot' | 'trending';

export type PostListFilters = {
  sortBy?: SortBy;
  page?: number;
  limit?: number;
};

export type PostsListResponse = {
  posts: Post[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
};

class ApiPostsRepository implements PostsRepository {
  async create(input: PostCreateInput): Promise<PostCreateResult> {
    const resp = await httpAuth.post(API_ENDPOINTS.POSTS.CREATEPOST, input);
    return unwrapApiResponse<PostCreateResult>(resp, 200);
  }

  async list(filters: PostListFilters = {}): Promise<PostsListResponse> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
      if (v == null) continue;
      if (!['page', 'limit', 'sortBy'].includes(k)) continue;

      if (Array.isArray(v)) {
        if (v.length) qs.set(k, v.join(','));
      } else {
        qs.set(k, String(v));
      }
    }
    const path = `${API_ENDPOINTS.POSTS.GETPOSTPRE}${qs.toString() ? `?${qs.toString()}` : ''}`;
    const resp = await httpAuth.get(path);
    const data = unwrapApiResponse<PostsListResponse>(resp, 200);
    return { ...data, posts: data.posts.map(normalizePost) };
  }

  async get(postId: string): Promise<Post> {
    const path = API_ENDPOINTS.POSTS.GETPOSTALL.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.get(path);
    const data = unwrapApiResponse<PostApiShape>(resp, 200);
    return normalizePost(data);
  }

  async update(postId: string, input: PostCreateInput): Promise<{ id: string; status: 'pending' | 'approved' | 'rejected' }> {
    const path = API_ENDPOINTS.POSTS.UPDATEPOST.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.put(path, input);
    return unwrapApiResponse<{ id: string; status: 'pending' | 'approved' | 'rejected' }>(resp, 200);
  }

  async delete(postId: string): Promise<void> {
    const path = API_ENDPOINTS.POSTS.DELETEPOST.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.delete(path);
    unwrapApiResponse<null>(resp, 200);
  }

  async like(postId: string): Promise<PostLikeResult> {
    const path = API_ENDPOINTS.POSTS.LIKEPOST.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.post(path, {});
    const data = unwrapApiResponse<PostLikeApiResult>(resp, 200);
    return normalizePostLikeResult(data);
  }

  async unlike(postId: string): Promise<PostLikeResult> {
    const path = API_ENDPOINTS.POSTS.UNLIKEPOST.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.delete(path);
    const data = unwrapApiResponse<PostLikeApiResult>(resp, 200);
    return normalizePostLikeResult(data);
  }

  async favorite(postId: string): Promise<{ is_favorited: boolean; favorite_count: number }> {
    const path = API_ENDPOINTS.POSTS.FAVORITEPOST.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.post(path, {});
    return unwrapApiResponse<{ is_favorited: boolean; favorite_count: number }>(resp, 200);
  }

  async unfavorite(postId: string): Promise<{ is_favorited: boolean; favorite_count: number }> {
    const path = API_ENDPOINTS.POSTS.UNFAVORITEPOST.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.delete(path);
    return unwrapApiResponse<{ is_favorited: boolean; favorite_count: number }>(resp, 200);
  }

  async updateCompanionStatus(postId: string, input: CompanionStatusUpdateRequest): Promise<void> {
    const path = API_ENDPOINTS.POSTS.COMPANION_STATUS.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.put(path, input);
    unwrapApiResponse<void>(resp, 200);
  }
}

const MOCK_AUTHORS: PostAuthor[] = [
  { id: 'mock-user-01', name: '王若琳', avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&h=120&crop=faces' },
  { id: 'mock-user-02', name: '陈嘉', avatar_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=120&h=120&crop=faces' },
  { id: 'mock-user-03', name: '李云鹏', avatar_url: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=120&h=120&crop=faces' },
  { id: 'mock-user-04', name: '周琪', avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&crop=faces' },
];

export function seedMockPosts(): Post[] {
  const now = '2025-11-12T08:00:00.000Z';
  const earlier = '2025-11-09T09:45:00.000Z';
  const weekAgo = '2025-11-05T13:20:00.000Z';
  return [
    {
      id: 'mock-share-001',
      post_type: 'share',
      share_type: 'recommend',
      title: '南区食堂的椒麻鸡惊艳到我',
      content: '邯郸南区二楼的椒麻鸡真的香，外酥里嫩，花椒的香气特别提神，还可以免费加一点酸菜一起拌着吃。',
      category: 'food',
      canteen: '邯郸校区南区食堂',
      tags: ['椒麻鸡', '打卡', '南区必吃'],
      images: [
        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=800&auto=format&fit=crop',
      ],
      cuisine: '川菜',
      flavors: ['麻辣', '香辣'],
      price: 18.5,
      author: MOCK_AUTHORS[0],
      stats: { like_count: 132, favorite_count: 47, comment_count: 23, view_count: 1045 },
      is_liked: false,
      is_favorited: false,
      created_at: now,
      updated_at: now,
    },
    {
      id: 'mock-share-002',
      post_type: 'share',
      share_type: 'warning',
      title: '春晖食堂的黑椒牛排有点踩雷',
      content: '黑椒没有香味，肉质偏柴，配菜也比较随意，价格却涨到了 28 元，感觉性价比不高，建议谨慎尝试。',
      category: 'food',
      canteen: '邯郸校区春晖食堂',
      tags: ['避雷', '春晖食堂'],
      images: [
        'https://images.unsplash.com/photo-1534939561126-855b8675edd7?w=800&auto=format&fit=crop',
      ],
      cuisine: '西式',
      flavors: ['黑椒', '偏咸'],
      price: 28,
      author: MOCK_AUTHORS[1],
      stats: { like_count: 56, favorite_count: 9, comment_count: 14, view_count: 612 },
      is_liked: false,
      is_favorited: false,
      created_at: earlier,
      updated_at: earlier,
    },
    {
      id: 'mock-seeking-001',
      post_type: 'seeking',
      title: '求推荐江湾食堂的清淡早餐',
      content: '最近早上胃口不好，想找一些清淡又不油腻的早餐，有没有同学推荐江湾食堂的靠谱摊位？',
      category: 'food',
      canteen: '江湾校区食堂',
      tags: ['早餐', '清淡'],
      images: [],
      budget_range: { min: 6, max: 15 },
      preferences: { prefer_flavors: ['清淡'], avoid_flavors: ['油炸'] },
      author: MOCK_AUTHORS[2],
      stats: { like_count: 21, favorite_count: 5, comment_count: 18, view_count: 389 },
      is_liked: false,
      is_favorited: false,
      created_at: weekAgo,
      updated_at: weekAgo,
    },
    {
      id: 'mock-share-003',
      post_type: 'share',
      share_type: 'recommend',
      title: '邯郸北区的番茄牛腩面好暖胃',
      content: '这碗番茄牛腩面汤底特别鲜，酸甜开胃，牛腩给得也很足，适合秋天晚上吃一碗暖暖身。',
      category: 'food',
      canteen: '邯郸校区北区食堂',
      tags: ['面食', '暖胃'],
      images: [
        'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop',
      ],
      cuisine: '中式',
      flavors: ['鲜', '清爽'],
      price: 16,
      author: MOCK_AUTHORS[2],
      stats: { like_count: 88, favorite_count: 31, comment_count: 19, view_count: 745 },
      is_liked: false,
      is_favorited: false,
      created_at: '2025-11-10T11:15:00.000Z',
      updated_at: '2025-11-10T11:15:00.000Z',
    },
    {
      id: 'mock-recipe-001',
      post_type: 'share',
      share_type: 'recommend',
      title: '寝室快手番茄蛋包饭教程',
      content: '用微波炉也能做出松软的蛋包饭，番茄酱煮一下更好吃，附带详细步骤和时间安排，适合宿舍党。',
      category: 'recipe',
      tags: ['宿舍料理', '番茄蛋包饭'],
      images: [
        'https://images.unsplash.com/photo-1589308078054-83299d4d71dc?w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1525755662778-989d0524087e?w=800&auto=format&fit=crop',
      ],
      cuisine: '家常',
      flavors: ['酸甜', '柔软'],
      price: 12,
      author: MOCK_AUTHORS[0],
      stats: { like_count: 201, favorite_count: 96, comment_count: 54, view_count: 1520 },
      is_liked: false,
      is_favorited: false,
      created_at: '2025-11-08T07:30:00.000Z',
      updated_at: '2025-11-08T07:30:00.000Z',
    },
  ];
}

class MockPostsRepository implements PostsRepository {
  private store: Post[] = seedMockPosts();

  private getTimestamp(value?: string) {
    if (!value) return 0;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  async create(input: PostCreateInput): Promise<PostCreateResult> {
    // 仅返回最小结果，模拟“创建成功，待审核”
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();
    // 构造最简 Post 入库，便于随后的列表/详情模拟
    const base: any = {
      id,
      post_type: input.post_type,
      title: input.title,
      content: input.content,
      category: input.category,
      canteen: input.canteen,
      tags: input.tags,
      images: input.images,
      created_at: now,
      updated_at: now,
      stats: { like_count: 0, favorite_count: 0, comment_count: 0, view_count: 0 },
      is_liked: false,
      is_favorited: false,
    };
    if (input.post_type === 'share') {
      base.share_type = (input as any).share_type;
      base.cuisine = (input as any).cuisine;
      base.flavors = (input as any).flavors;
      base.price = (input as any).price;
    } else if (input.post_type === 'seeking') {
      base.budget_range = (input as any).budget_range;
      base.preferences = (input as any).preferences;
    }
    this.store.unshift(base as Post);
    return { id, post_type: input.post_type, status: 'pending' };
  }

  async list(filters: PostListFilters = {}): Promise<PostsListResponse> {
    const page = Math.max(1, Math.floor(filters.page ?? 1));
    const limit = Math.min(50, Math.max(1, Math.floor(filters.limit ?? 20)));
    let arr = [...this.store];

    arr.sort((a, b) => {
      switch (filters.sortBy) {
        case 'hot':
          return (b.stats?.like_count ?? 0) - (a.stats?.like_count ?? 0);
        case 'trending':
          return this.getTimestamp(b.updated_at ?? b.created_at) - this.getTimestamp(a.updated_at ?? a.created_at);
        case 'latest':
        default:
          return this.getTimestamp(b.created_at) - this.getTimestamp(a.created_at);
      }
    });

    const total = arr.length;
    const total_pages = Math.max(1, Math.ceil(total / limit));
    const start = (page - 1) * limit;
    const posts = arr.slice(start, start + limit);
    return { posts, pagination: { page, limit, total, total_pages } };
  }

  async get(postId: string): Promise<Post> {
    const found = this.store.find((p) => p.id === postId);
    if (!found) throw new Error('未找到帖子');
    // 模拟浏览量 +1
    (found.stats ||= {}).view_count = (found.stats?.view_count ?? 0) + 1;
    return { ...found };
  }

  async update(postId: string, input: PostCreateInput): Promise<{ id: string; status: 'pending' | 'approved' | 'rejected' }> {
    const idx = this.store.findIndex((p) => p.id === postId);
    if (idx < 0) throw new Error('未找到帖子');
    const now = new Date().toISOString();
    const old = this.store[idx] as any;
    const merged: any = {
      ...old,
      post_type: input.post_type,
      title: input.title,
      content: input.content,
      category: input.category,
      canteen: input.canteen,
      tags: input.tags,
      images: input.images,
      updated_at: now,
    };
    if (input.post_type === 'share') {
      merged.share_type = (input as any).share_type;
      merged.cuisine = (input as any).cuisine;
      merged.flavors = (input as any).flavors;
      merged.price = (input as any).price;
    } else if (input.post_type === 'seeking') {
      merged.budget_range = (input as any).budget_range;
      merged.preferences = (input as any).preferences;
    }
    this.store[idx] = merged as Post;
    return { id: postId, status: 'pending' };
  }

  async delete(postId: string): Promise<void> {
    this.store = this.store.filter((p) => p.id !== postId);
  }

  async like(postId: string): Promise<{ is_liked: boolean; like_count: number }> {
    const p = this.store.find((x) => x.id === postId) as any;
    if (!p) throw new Error('未找到帖子');
    if (!p.is_liked) {
      p.is_liked = true;
      p.stats.like_count = (p.stats?.like_count ?? 0) + 1;
    }
    return { is_liked: true, like_count: p.stats.like_count ?? 0 };
  }

  async unlike(postId: string): Promise<{ is_liked: boolean; like_count: number }> {
    const p = this.store.find((x) => x.id === postId) as any;
    if (!p) throw new Error('未找到帖子');
    if (p.is_liked) {
      p.is_liked = false;
      p.stats.like_count = Math.max(0, (p.stats?.like_count ?? 0) - 1);
    }
    return { is_liked: false, like_count: p.stats.like_count ?? 0 };
  }

  async favorite(postId: string): Promise<{ is_favorited: boolean; favorite_count: number }> {
    const p = this.store.find((x) => x.id === postId) as any;
    if (!p) throw new Error('未找到帖子');
    if (!p.is_favorited) {
      p.is_favorited = true;
      p.stats.favorite_count = (p.stats?.favorite_count ?? 0) + 1;
    }
    return { is_favorited: true, favorite_count: p.stats.favorite_count ?? 0 };
  }

  async unfavorite(postId: string): Promise<{ is_favorited: boolean; favorite_count: number }> {
    const p = this.store.find((x) => x.id === postId) as any;
    if (!p) throw new Error('未找到帖子');
    if (p.is_favorited) {
      p.is_favorited = false;
      p.stats.favorite_count = Math.max(0, (p.stats?.favorite_count ?? 0) - 1);
    }
    return { is_favorited: false, favorite_count: p.stats.favorite_count ?? 0 };
  }

  async updateCompanionStatus(postId: string, input: CompanionStatusUpdateRequest): Promise<void> {
    // Mock implementation: do nothing
  }

}

export const postsRepository: PostsRepository = USE_MOCK
  ? new MockPostsRepository()
  : new ApiPostsRepository();



