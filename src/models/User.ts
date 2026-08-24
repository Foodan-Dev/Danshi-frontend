export type Gender = 'male' | 'female' | 'other';
export type ManagementRole = 'dict_reviewer' | 'moderator' | 'super_admin';
export type DisplayRole = 'user' | ManagementRole;

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
  /** 仅用于界面展示的主角色；权限判断必须使用 roles。 */
  role: DisplayRole;
  roles: ManagementRole[];
  avatar_url?: string | null;
  bio?: string | null;
  stats?: UserStats;
  is_following?: boolean;
  created_at?: string;
}
