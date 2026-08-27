import type { User } from '@/src/models/User';

export type PostType = 'share' | 'seeking';
export type ShareType = 'recommend' | 'warning';

export type Category = 'food' | 'recipe';

export type PostAuthor = Pick<User, 'id' | 'name' | 'avatar_url'> & {
  is_following?: boolean | null;
};

export type PostCanteen = { code: string; name: string; campus: string };
export type PostCanteenWindow = { id: number; name: string; floor?: string | null };

export interface PostStats {
  like_count?: number;
  favorite_count?: number;
  comment_count?: number;
  view_count?: number;
}

export interface PostBase {
  id: number;
  post_type: PostType;
  title: string;
  content: string;
  category: Category;
  canteen?: PostCanteen | null;
  canteen_window?: PostCanteenWindow | null;
  tags?: string[];
  images?: string[];
  image_thumbs?: string[];
  image_displays?: string[];
  author?: PostAuthor;
  stats?: PostStats;
  is_liked?: boolean;
  is_favorited?: boolean;
  created_at?: string; // ISO
  updated_at?: string; // ISO
  status?: 'draft' | 'pending' | 'approved' | 'rejected';
  is_edited?: boolean;
}

export interface SharePost extends Omit<PostBase, 'images'> {
  post_type: 'share';
  share_type: ShareType;
  cuisine?: string;
  flavors?: string[];
  price?: string;
  images: string[]; // 1-9
  image_thumbs?: string[];
  image_displays?: string[];
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
  canteen_code?: string | null;
  canteen_window_id?: number | null;
  tags?: string[];
  images?: string[];
};

export type SharePostCreateInput = CommonCreateBase & {
  post_type: 'share';
  share_type: ShareType;
  cuisine?: string;
  flavors?: string[];
  price?: string;
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
  id: number;
  post_type: PostType;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
};
