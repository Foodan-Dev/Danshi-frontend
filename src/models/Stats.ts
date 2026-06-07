export type PlatformStats = {
  total_users: number;
  total_posts: number;
  total_comments: number;
  total_views: number;
  active_users: number;
  pending_posts: number;
  today_stats: {
    new_users: number;
    new_posts: number;
    new_comments: number;
    new_views: number;
  };
};

export type UserAggregateStats = {
  post_count: number;
  total_likes: number;
  total_favorites: number;
  total_views: number;
  comment_count: number;
  follower_count: number;
  following_count: number;
};
