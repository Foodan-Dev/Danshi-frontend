import type { User } from '@/src/models/User';

export type CommentSort = 'latest' | 'hot';

export type CommentAuthor = Pick<User, 'id' | 'name' | 'avatar_url'> & {
  is_following?: boolean;
};

export interface MentionedUser {
  id: string;
  name: string;
}

export interface CommentBase {
  id: string;
  content: string;
  author: CommentAuthor;
  mentioned_users?: MentionedUser[];
  like_count: number;
  is_liked?: boolean;
  is_author?: boolean;
  parent_id?: string | null;
  reply_to?: MentionedUser | null;
  created_at: string; // ISO string
}

export type CommentReply = CommentBase;

export interface Comment extends CommentBase {
  reply_count: number;
  replies?: CommentReply[];
}

export type CommentEntity = Comment | CommentReply;

export interface CommentsPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface CommentsListResponse {
  comments: Comment[];
  pagination: CommentsPagination;
}

export interface CommentRepliesResponse {
  replies: CommentReply[];
  pagination: CommentsPagination;
}

export type CreateCommentInput = {
  content: string;
  parent_id?: string | null;
  reply_to_user_id?: string | null;
  mentioned_user_ids?: string[];
};
