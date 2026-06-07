import { API_ENDPOINTS, USE_MOCK } from '@/src/constants/app';
import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import type { PlatformStats, UserAggregateStats } from '@/src/models/Stats';

export interface StatsRepository {
  getPlatformStats(): Promise<PlatformStats>;
  getUserStats(userId: string): Promise<UserAggregateStats>;
}

class ApiStatsRepository implements StatsRepository {
  async getPlatformStats(): Promise<PlatformStats> {
    throw new Error('Stats API not implemented');
    // const resp = await httpAuth.get<ApiResponse<PlatformStats>>(API_ENDPOINTS.STATS.PLATFORM);
    // return unwrapApiResponse<PlatformStats>(resp, 200);
  }

  async getUserStats(userId: string): Promise<UserAggregateStats> {
    throw new Error('Stats API not implemented');
    // const path = API_ENDPOINTS.STATS.USER.replace(':userId', encodeURIComponent(userId));
    // const resp = await httpAuth.get<ApiResponse<UserAggregateStats>>(path);
    // return unwrapApiResponse<UserAggregateStats>(resp, 200);
  }
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class MockStatsRepository implements StatsRepository {
  async getPlatformStats(): Promise<PlatformStats> {
    await delay(80);
    return {
      total_users: 1250,
      total_posts: 3420,
      total_comments: 8960,
      total_views: 125680,
      active_users: 456,
      pending_posts: 12,
      today_stats: {
        new_users: 15,
        new_posts: 28,
        new_comments: 156,
        new_views: 3580,
      },
    };
  }

  async getUserStats(userId: string): Promise<UserAggregateStats> {
    await delay(60);
    const seed = Math.abs([...userId].reduce((acc, ch) => acc + ch.charCodeAt(0), 0));
    const pseudo = (mod: number, base: number) => (seed % mod) + base;
    return {
      post_count: pseudo(20, 5),
      total_likes: pseudo(200, 40),
      total_favorites: pseudo(120, 10),
      total_views: pseudo(3000, 500),
      comment_count: pseudo(80, 5),
      follower_count: pseudo(500, 20),
      following_count: pseudo(100, 10),
    };
  }
}

export const statsRepository: StatsRepository = USE_MOCK ? new MockStatsRepository() : new ApiStatsRepository();
