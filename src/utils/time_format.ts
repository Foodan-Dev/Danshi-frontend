// ==================== 日期格式化工具 ====================
// 统一管理全项目的日期/时间格式化逻辑，避免各组件重复实现

/**
 * 将时间戳格式化为相对时间（如"刚刚"、"5分钟前"、"昨天"等）
 * @param dateString ISO 日期字符串
 * @returns 相对时间字符串
 */
export function formatRelativeTime(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // 刚刚（1分钟内）
  if (diffMinutes < 1) {
    return '刚刚';
  }

  // X分钟前（1小时内）
  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  }

  // X小时前（24小时内）
  if (diffHours < 24) {
    return `${diffHours}小时前`;
  }

  // 昨天
  if (diffDays === 1) {
    return '昨天';
  }

  // X天前（7天内）
  if (diffDays < 7) {
    return `${diffDays}天前`;
  }

  // 超过7天显示具体日期
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // 如果是今年，不显示年份
  if (year === now.getFullYear()) {
    return `${month}月${day}日`;
  }

  return `${year}年${month}月${day}日`;
}

/** 绝对日期格式风格 */
export type DateFormatStyle = 'compact' | 'short' | 'full';

/**
 * 将日期字符串格式化为绝对日期
 * - `compact`: "03-16"  (补零，用于卡片展示)
 * - `short`:   "3/16"   (不补零，用于管理列表)
 * - `full`:    "2026/3/16" (含年份，用于用户详情)
 */
export function formatDate(dateString: string, style: DateFormatStyle = 'compact'): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  switch (style) {
    case 'compact':
      return `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    case 'short':
      return `${m}/${d}`;
    case 'full':
      return `${y}/${m}/${d}`;
  }
}

/**
 * 相对时间 + 绝对日期的混合格式：
 * 7天内显示相对时间，超过 7 天显示 MM-DD 格式
 * 常用于帖子详情页的时间展示
 */
export function formatRelativeOrDate(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  if (diffHour < 24) return `${diffHour} 小时前`;
  if (diffDay < 7) return `${diffDay} 天前`;

  return formatDate(dateString, 'compact');
}

/**
 * 格式化当前日期（用于预览面板等场景）
 */
export function formatCurrentDate(style: DateFormatStyle = 'compact'): string {
  return formatDate(new Date().toISOString(), style);
}

