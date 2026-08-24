export type Gender = 'male' | 'female' | 'other';

export interface UserStats {
  post_count: number;
  like_count: number;
  favorite_count: number;
  follower_count: number;
  following_count: number;
}

export interface User {
  id: number;
  email: string;
  name: string;
  gender?: Gender | null;
  role: 'user' | 'admin' | 'super_admin';
  avatar_url?: string | null;
  bio?: string | null;
  stats?: UserStats;
  is_following?: boolean;
  created_at?: string;
}
