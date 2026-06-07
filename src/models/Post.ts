import type { User } from '@/src/models/User';

export type PostType = 'share' | 'seeking';
export type ShareType = 'recommend' | 'warning';

export type Category = 'food' | 'recipe';

export type PostAuthor = Pick<User, 'id' | 'name' | 'avatar_url'>;

export interface PostStats {
  like_count?: number;
  favorite_count?: number;
  comment_count?: number;
  view_count?: number;
}

export interface PostBase {
  id: string;
  post_type: PostType;
  title: string;
  content: string;
  category: Category;
  canteen?: string;
  tags?: string[];
  images?: string[];
  author?: PostAuthor;
  stats?: PostStats;
  is_liked?: boolean;
  is_favorited?: boolean;
  created_at?: string; // ISO
  updated_at?: string; // ISO
}

export interface SharePost extends Omit<PostBase, 'images'> {
  post_type: 'share';
  share_type: ShareType;
  cuisine?: string;
  flavors?: string[];
  price?: number;
  images: string[]; // 1-9
}

export interface SeekingPost extends PostBase {
  post_type: 'seeking';
  budget_range?: { min: number; max: number };
  preferences?: { avoid_flavors?: string[]; prefer_flavors?: string[] };
}

export type Post = SharePost | SeekingPost;

// Create inputs mirror domain fields, without server-generated ones
export type CommonCreateBase = {
  post_type: PostType;
  title: string;
  content: string;
  category: Category;
  canteen?: string;
  tags?: string[];
  images?: string[];
};

export type SharePostCreateInput = CommonCreateBase & {
  post_type: 'share';
  share_type: ShareType;
  cuisine?: string;
  flavors?: string[];
  price?: number;
  images: string[]; // required for share
};

export type SeekingPostCreateInput = CommonCreateBase & {
  post_type: 'seeking';
  budget_range?: { min: number; max: number };
  preferences?: { avoid_flavors?: string[]; prefer_flavors?: string[] };
};

export type PostCreateInput =
  | SharePostCreateInput
  | SeekingPostCreateInput;

export type PostCreateResult = {
  id: string;
  post_type: PostType;
  status: 'pending' | 'approved' | 'rejected';
};

export type CompanionStatus = 'open' | 'full' | 'closed';

export type CompanionStatusUpdateRequest = {
  status: CompanionStatus;
  current_people?: number | null;
};
