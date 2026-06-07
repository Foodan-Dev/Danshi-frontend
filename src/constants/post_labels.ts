import type { Post } from '@/src/models/Post';

/** 帖子类型中文标签 */
export const TYPE_LABEL: Record<Post['post_type'], string> = {
  share: '分享',
  seeking: '求助',
};

/** 分享子类型中文标签 */
export const SHARE_LABEL: Record<'recommend' | 'warning', string> = {
  recommend: '推荐',
  warning: '避雷',
};

/** 列表 / 详情页通用的加载状态 */
export type LoaderState = 'idle' | 'initial' | 'refresh';

