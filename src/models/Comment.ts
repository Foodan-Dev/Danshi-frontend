import type { User } from '@/src/models/User';

export type CommentSort = 'latest' | 'hot';

export type CommentAuthor = Pick<User, 'id' | 'name' | 'avatar_url'> & {
  is_following?: boolean;
};

export interface MentionedUser {
  id: number;
  name: string;
}

export interface CommentBase {
  id: number;
  content: string;
  author?: CommentAuthor;
  mentioned_users?: MentionedUser[];
  like_count: number;
  is_liked?: boolean;
  is_author?: boolean;
  parent_id?: number | null;
  reply_to?: MentionedUser | null;
  created_at: string; // ISO string
  is_deleted?: boolean;
  is_edited?: boolean;
}

export type CommentReply = CommentBase;

export interface Comment extends CommentBase {
  reply_count: number;
  replies?: CommentReply[];
}

export type CommentEntity = Comment | CommentReply;

export interface CommentsPagination {
  limit: number;
  next_cursor: string | null;
  has_more: boolean;
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
  parent_id?: number | null;
  reply_to_user_id?: number | null;
  mentioned_user_ids?: number[];
};
