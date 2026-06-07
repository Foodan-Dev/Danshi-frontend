export type Gender = 'male' | 'female';

export interface UserStats {
  post_count: number;
  like_count: number;
  favorite_count: number;
  follower_count: number;
  following_count: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  gender?: Gender;
  hometown?: string;
  role: 'user' | 'admin' | 'super_admin';
  avatar_url?: string | null;
  bio?: string;
  stats?: UserStats;
  is_following?: boolean;
  created_at?: string;
}
