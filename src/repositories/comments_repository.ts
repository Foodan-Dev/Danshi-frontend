import { API_ENDPOINTS, USE_MOCK } from '@/src/constants/app';
import { http } from '@/src/lib/http/client';
import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse } from '@/src/lib/http/response';
import type {
  Comment,
  CommentAuthor,
  CommentEntity,
  CommentRepliesResponse,
  CommentReply,
  CommentsListResponse,
  CommentSort,
  CreateCommentInput,
  MentionedUser,
} from '@/src/models/Comment';

export type CommentListParams = {
  page?: number;
  limit?: number;
  sortBy?: CommentSort;
};

export type CommentRepliesParams = {
  page?: number;
  limit?: number;
};

export type CommentLikeResult = { is_liked: boolean; like_count: number };

export interface CommentsRepository {
  listByPost(postId: string, params?: CommentListParams): Promise<CommentsListResponse>;
  listReplies(commentId: string, params?: CommentRepliesParams): Promise<CommentRepliesResponse>;
  create(postId: string, payload: CreateCommentInput): Promise<CommentEntity>;
  like(commentId: string): Promise<CommentLikeResult>;
  unlike(commentId: string): Promise<CommentLikeResult>;
  delete(commentId: string): Promise<void>;
}

class ApiCommentsRepository implements CommentsRepository {
  private buildQuery(params?: Record<string, unknown>) {
    const qs = new URLSearchParams();
    if (!params) return '';
    Object.entries(params).forEach(([key, value]) => {
      if (value == null) return;
      if (!['page', 'limit', 'sortBy'].includes(key)) return;
      qs.append(key, String(value));
    });
    const str = qs.toString();
    return str ? `?${str}` : '';
  }

  async listByPost(postId: string, params: CommentListParams = {}): Promise<CommentsListResponse> {
    const path = API_ENDPOINTS.COMMENTS.LIST_FOR_POST.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.get(`${path}${this.buildQuery(params)}`);
    return unwrapApiResponse<CommentsListResponse>(resp, 200);
  }

  async listReplies(commentId: string, params: CommentRepliesParams = {}): Promise<CommentRepliesResponse> {
    const path = API_ENDPOINTS.COMMENTS.LIST_REPLIES.replace(':commentId', encodeURIComponent(commentId));
    const resp = await httpAuth.get(`${path}${this.buildQuery(params)}`);
    return unwrapApiResponse<CommentRepliesResponse>(resp, 200);
  }

  async create(postId: string, payload: CreateCommentInput): Promise<CommentEntity> {
    const path = API_ENDPOINTS.COMMENTS.CREATE.replace(':postId', encodeURIComponent(postId));
    const resp = await httpAuth.post(path, payload);
    return unwrapApiResponse<CommentEntity>(resp, 200);
  }

  async like(commentId: string): Promise<CommentLikeResult> {
    const path = API_ENDPOINTS.COMMENTS.LIKE.replace(':commentId', encodeURIComponent(commentId));
    const resp = await httpAuth.post(path, {});
    return unwrapApiResponse<CommentLikeResult>(resp, 200);
  }

  async unlike(commentId: string): Promise<CommentLikeResult> {
    const path = API_ENDPOINTS.COMMENTS.UNLIKE.replace(':commentId', encodeURIComponent(commentId));
    const resp = await httpAuth.delete(path);
    return unwrapApiResponse<CommentLikeResult>(resp, 200);
  }

  async delete(commentId: string): Promise<void> {
    const path = API_ENDPOINTS.COMMENTS.DELETE.replace(':commentId', encodeURIComponent(commentId));
    const resp = await httpAuth.delete(path);
    unwrapApiResponse<null>(resp, 200);
  }
}

const MOCK_AUTHORS: CommentAuthor[] = [
  {
    id: 'mock-user-01',
    name: '李四',
    avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&h=120&crop=faces',
    is_following: true,
  },
  {
    id: 'mock-user-02',
    name: '王五',
    avatar_url: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=120&h=120&crop=faces',
  },
  {
    id: 'mock-user-03',
    name: '赵六',
    avatar_url: 'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=120&h=120&crop=faces',
  },
  {
    id: 'mock-user-04',
    name: '张三',
    avatar_url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=120&h=120&crop=faces',
  },
];

const CURRENT_USER: CommentAuthor = {
  id: 'mock-current-user',
  name: '复旦吃货',
  avatar_url: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=120&h=120&crop=faces',
};

type StoredComment = Comment & { replies: CommentReply[] };

function createSeedComments(): Record<string, StoredComment[]> {
  const now = new Date('2025-11-15T12:00:00Z');

  const shareComments: StoredComment[] = [
    {
      id: 'mock-comment-001',
      content: '看起来真的很香，准备周末去试试！',
      author: MOCK_AUTHORS[0],
      mentioned_users: [],
      like_count: 5,
      is_liked: false,
      is_author: false,
      parent_id: null,
      reply_to: null,
      created_at: now.toISOString(),
      reply_count: 3,
      replies: [
        {
          id: 'mock-reply-001',
          content: '去的时候记得早点排队，晚了要排很久。',
          author: MOCK_AUTHORS[1],
          mentioned_users: [],
          like_count: 2,
          is_liked: false,
          is_author: false,
          parent_id: 'mock-comment-001',
          reply_to: { id: MOCK_AUTHORS[0].id, name: MOCK_AUTHORS[0].name },
          created_at: new Date(now.getTime() + 1000 * 60).toISOString(),
        },
        {
          id: 'mock-reply-002',
          content: '确实，人多的时候排队体验不好。',
          author: MOCK_AUTHORS[2],
          mentioned_users: [],
          like_count: 1,
          is_liked: false,
          is_author: false,
          parent_id: 'mock-comment-001',
          reply_to: { id: MOCK_AUTHORS[1].id, name: MOCK_AUTHORS[1].name },
          created_at: new Date(now.getTime() + 1000 * 120).toISOString(),
        },
        {
          id: 'mock-reply-004',
          content: '昨天去的时候队伍排到了门口，建议工作日去。',
          author: CURRENT_USER,
          mentioned_users: [],
          like_count: 0,
          is_liked: false,
          is_author: true,
          parent_id: 'mock-comment-001',
          reply_to: { id: MOCK_AUTHORS[2].id, name: MOCK_AUTHORS[2].name },
          created_at: new Date(now.getTime() + 1000 * 180).toISOString(),
        },
      ],
    },
    {
      id: 'mock-comment-002',
      content: '这个帖子完全被你种草了，今晚就冲！',
      author: MOCK_AUTHORS[2],
      mentioned_users: [],
      like_count: 8,
      is_liked: true,
      is_author: true,
      parent_id: null,
      reply_to: null,
      created_at: new Date(now.getTime() - 1000 * 60 * 30).toISOString(),
      reply_count: 1,
      replies: [
        {
          id: 'mock-reply-003',
          content: '作者亲测好吃，推荐大家尝试招牌牛肉饭。',
          author: CURRENT_USER,
          mentioned_users: [],
          like_count: 4,
          is_liked: false,
          is_author: true,
          parent_id: 'mock-comment-002',
          reply_to: { id: MOCK_AUTHORS[2].id, name: MOCK_AUTHORS[2].name },
          created_at: new Date(now.getTime() - 1000 * 60 * 25).toISOString(),
        },
      ],
    },
    {
      id: 'mock-comment-003',
      content: '店里有学生优惠券，别忘了在收银台扫码领取。',
      author: MOCK_AUTHORS[3],
      mentioned_users: [{ id: MOCK_AUTHORS[1].id, name: MOCK_AUTHORS[1].name }],
      like_count: 1,
      is_liked: false,
      is_author: false,
      parent_id: null,
      reply_to: null,
      created_at: new Date(now.getTime() - 1000 * 60 * 90).toISOString(),
      reply_count: 0,
      replies: [],
    },
  ];

  const seekingComments: StoredComment[] = [
    {
      id: 'mock-comment-101',
      content: '我有优惠券，可以一起拼，私信我微信号。',
      author: MOCK_AUTHORS[0],
      mentioned_users: [],
      like_count: 3,
      is_liked: false,
      is_author: false,
      parent_id: null,
      reply_to: null,
      created_at: new Date(now.getTime() - 1000 * 60 * 15).toISOString(),
      reply_count: 0,
      replies: [],
    },
    {
      id: 'mock-comment-102',
      content: '口味偏辣的话推荐点麻辣牛肉锅底，搭配油麦菜很不错。',
      author: MOCK_AUTHORS[1],
      mentioned_users: [],
      like_count: 6,
      is_liked: false,
      is_author: false,
      parent_id: null,
      reply_to: null,
      created_at: new Date(now.getTime() - 1000 * 60 * 45).toISOString(),
      reply_count: 2,
      replies: [
        {
          id: 'mock-reply-101',
          content: '谢谢推荐！我们正愁不知道点什么。',
          author: MOCK_AUTHORS[2],
          mentioned_users: [],
          like_count: 0,
          is_liked: false,
          is_author: false,
          parent_id: 'mock-comment-102',
          reply_to: { id: MOCK_AUTHORS[1].id, name: MOCK_AUTHORS[1].name },
          created_at: new Date(now.getTime() - 1000 * 60 * 40).toISOString(),
        },
        {
          id: 'mock-reply-102',
          content: '@李四 可以的话一起拼桌吧，我也去！',
          author: CURRENT_USER,
          mentioned_users: [{ id: MOCK_AUTHORS[0].id, name: MOCK_AUTHORS[0].name }],
          like_count: 2,
          is_liked: false,
          is_author: false,
          parent_id: 'mock-comment-102',
          reply_to: { id: MOCK_AUTHORS[0].id, name: MOCK_AUTHORS[0].name },
          created_at: new Date(now.getTime() - 1000 * 60 * 35).toISOString(),
        },
      ],
    },
  ];

  const companionComments: StoredComment[] = [
    {
      id: 'mock-comment-201',
      content: '明天中午12点可以到校门集合吗？我带车。',
      author: CURRENT_USER,
      mentioned_users: [],
      like_count: 7,
      is_liked: true,
      is_author: true,
      parent_id: null,
      reply_to: null,
      created_at: new Date(now.getTime() + 1000 * 60 * 60).toISOString(),
      reply_count: 1,
      replies: [
        {
          id: 'mock-reply-201',
          content: '可以的！我会提前10分钟到。',
          author: MOCK_AUTHORS[1],
          mentioned_users: [],
          like_count: 1,
          is_liked: false,
          is_author: false,
          parent_id: 'mock-comment-201',
          reply_to: { id: CURRENT_USER.id, name: CURRENT_USER.name },
          created_at: new Date(now.getTime() + 1000 * 60 * 90).toISOString(),
        },
      ],
    },
    {
      id: 'mock-comment-202',
      content: '还有位置吗？我想一起去，AA没问题。',
      author: MOCK_AUTHORS[3],
      mentioned_users: [],
      like_count: 0,
      is_liked: false,
      is_author: false,
      parent_id: null,
      reply_to: null,
      created_at: new Date(now.getTime() + 1000 * 60 * 30).toISOString(),
      reply_count: 0,
      replies: [],
    },
  ];

  return {
    'mock-share-001': shareComments,
    'mock-seeking-001': seekingComments,
    'mock-companion-001': companionComments,
  };
}

class MockCommentsRepository implements CommentsRepository {
  private store: Record<string, StoredComment[]> = createSeedComments();

  private findComment(commentId: string): { parentList: StoredComment[]; comment?: StoredComment; reply?: CommentReply; parent?: StoredComment } {
    for (const [, comments] of Object.entries(this.store)) {
      const comment = comments.find((c) => c.id === commentId);
      if (comment) {
        return { parentList: comments, comment };
      }
      for (const c of comments) {
        const reply = c.replies.find((r) => r.id === commentId);
        if (reply) {
          return { parentList: comments, reply, parent: c };
        }
      }
    }
    return { parentList: [] };
  }

  private paginate<T>(items: T[], page = 1, limit = 20) {
    const safePage = Math.max(1, Math.floor(page));
    const safeLimit = Math.max(1, Math.min(50, Math.floor(limit)));
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / safeLimit));
    const start = (safePage - 1) * safeLimit;
    return {
      data: items.slice(start, start + safeLimit),
      pagination: { page: safePage, limit: safeLimit, total, total_pages: totalPages },
    };
  }

  private cloneComment(comment: StoredComment): StoredComment {
    return {
      ...comment,
      replies: comment.replies.map((r) => ({ ...r })),
    };
  }

  async listByPost(postId: string, params: CommentListParams = {}): Promise<CommentsListResponse> {
    const comments = this.store[postId] ?? [];
    const sorted = [...comments].sort((a, b) => {
      if (params.sortBy === 'hot') return b.like_count - a.like_count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    const { data, pagination } = this.paginate(sorted, params.page, params.limit ?? 20);

    const trimmedReplies = data.map((comment) => {
      const clone = this.cloneComment(comment);
      clone.replies = clone.replies.slice(0, 3);
      return clone;
    });

    return { comments: trimmedReplies, pagination };
  }

  async listReplies(commentId: string, params: CommentRepliesParams = {}): Promise<CommentRepliesResponse> {
    const { comment, reply, parent } = this.findComment(commentId);
    let source: CommentReply[] | undefined;
    if (comment) {
      source = comment.replies;
    } else if (reply && parent) {
      source = parent.replies;
    }
    if (!source) throw new Error('评论不存在');

    const { data, pagination } = this.paginate(source, params.page, params.limit ?? 10);
    return { replies: data.map((r) => ({ ...r })), pagination };
  }

  async create(postId: string, payload: CreateCommentInput): Promise<CommentEntity> {
    const content = payload.content.trim();
    const mentioned_users: MentionedUser[] = (payload.mentioned_user_ids ?? []).map((id) => ({
      id,
      name: `用户${id.slice(-4)}`,
    }));
    const created_at = new Date().toISOString();
    const id = `mock-comment-${Date.now()}`;

    if (!payload.parent_id) {
      const comment: StoredComment = {
        id,
        content,
        author: CURRENT_USER,      mentioned_users,
        like_count: 0,
        is_liked: false,
        is_author: false,
        parent_id: null,
        reply_to: null,      created_at,
        reply_count: 0,
        replies: [],
      };
      this.store[postId] = [comment, ...(this.store[postId] ?? [])];
      return this.cloneComment(comment);
    }

    const { comment: parentComment } = this.findComment(payload.parent_id);
    if (!parentComment) throw new Error('父评论不存在');

    const reply_to: MentionedUser | null = payload.reply_to_user_id
      ? { id: payload.reply_to_user_id, name: `用户${payload.reply_to_user_id.slice(-4)}` }
      : null;

    const reply: CommentReply = {
      id,
      content,
      author: CURRENT_USER,      mentioned_users,
      like_count: 0,
      is_liked: false,
      is_author: false,
      parent_id: payload.parent_id,      reply_to,      created_at,
    };
    parentComment.replies.unshift(reply);
    parentComment.reply_count = parentComment.replies.length;
    return { ...reply };
  }

  async like(commentId: string): Promise<CommentLikeResult> {
    const { comment, reply } = this.findComment(commentId);
    const target = comment ?? reply;
    if (!target) throw new Error('评论不存在');
    if (!target.is_liked) {
      target.is_liked = true;
      target.like_count += 1;
    }
    return { is_liked: true, like_count: target.like_count };
  }

  async unlike(commentId: string): Promise<CommentLikeResult> {
    const { comment, reply } = this.findComment(commentId);
    const target = comment ?? reply;
    if (!target) throw new Error('评论不存在');
    if (target.is_liked) {
      target.is_liked = false;
      target.like_count = Math.max(0, target.like_count - 1);
    }
    return { is_liked: false, like_count: target.like_count };
  }

  async delete(commentId: string): Promise<void> {
    const { parentList, comment, reply, parent } = this.findComment(commentId);
    if (comment) {
      const idx = parentList.findIndex((c) => c.id === comment.id);
      if (idx >= 0) parentList.splice(idx, 1);
      return;
    }
    if (reply && parent) {
      parent.replies = parent.replies.filter((r) => r.id !== reply.id);
      parent.reply_count = parent.replies.length;
      return;
    }
    throw new Error('评论不存在');
  }
}

export const commentsRepository: CommentsRepository = USE_MOCK
  ? new MockCommentsRepository()
  : new ApiCommentsRepository();




