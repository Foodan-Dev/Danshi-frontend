import { AppError } from '@/src/lib/errors/app_error';
import { statsRepository } from '@/src/repositories/stats_repository';
import type { PlatformStats, UserAggregateStats } from '@/src/models/Stats';

const isNonEmpty = (value?: string) => !!value && value.trim().length > 0;

export const statsService = {
  async getPlatformStats(): Promise<PlatformStats> {
    return statsRepository.getPlatformStats();
  },

  async getUserStats(userId: string): Promise<UserAggregateStats> {
    if (!isNonEmpty(userId)) throw new AppError('缺少用户ID');
    return statsRepository.getUserStats(userId.trim());
  },
};
