import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import { API_ENDPOINTS } from '@/src/constants/app';

// ==================== 类型定义 ====================

/**
 * 通知类型
 * - comment: 评论了你的帖子
 * - reply: 回复了你的评论
 * - like_post: 点赞了你的帖子
 * - like_comment: 点赞了你的评论
 * - follow: 关注了你
 * - mention: @提到了你
 */
export type NotificationType = 
  | 'comment' 
  | 'reply' 
  | 'like_post' 
  | 'like_comment' 
  | 'follow' 
  | 'mention';

/**
 * 关联对象类型
 */
export type NotificationRelatedType = 'post' | 'comment';

/**
 * 通知发送者
 */
export type NotificationSender = {
  id: string;
  name: string;
  avatar_url?: string | null;
};

/**
 * 通知实体
 */
export type Notification = {
  id: string;
  type: NotificationType;
  sender: NotificationSender;
  related_id?: string | null;
  related_type?: NotificationRelatedType | null;
  post_id?: string | null;
  content?: string | null; // 通知内容预览（评论内容的前100个字符）
  is_read: boolean;
  created_at: string; // ISO 8601
};

/**
 * 分页信息
 */
export type Pagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

// ==================== 请求参数类型 ====================

export type ListNotificationsParams = {
  page?: number;
  limit?: number;
  is_read?: boolean;
  type?: NotificationType;
};

// ==================== 响应类型 ====================

export type ListNotificationsResponse = {
  notifications: Notification[];
  pagination: Pagination;
  unread_count: number;
};

export type UnreadCountResponse = {
  unread_count: number;
};

export type MarkReadResponse = void;

export type MarkAllReadResponse = {
  marked_count: number;
};

// ==================== 工具函数 ====================

const appendQueryParam = (qs: URLSearchParams, key: string, value: unknown) => {
  if (value == null) return;
  if (typeof value === 'boolean') {
    qs.set(key, value ? 'true' : 'false');
    return;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return;
    qs.set(key, trimmed);
    return;
  }
  qs.set(key, String(value));
};

// ==================== Repository 接口 ====================

export interface NotificationsRepository {
  /**
   * 获取通知列表
   */
  list(params?: ListNotificationsParams): Promise<ListNotificationsResponse>;
  
  /**
   * 获取未读通知数量
   */
  getUnreadCount(): Promise<UnreadCountResponse>;
  
  /**
   * 标记单个通知为已读
   */
  markAsRead(notificationId: string): Promise<MarkReadResponse>;
  
  /**
   * 标记所有通知为已读
   */
  markAllAsRead(): Promise<MarkAllReadResponse>;
}

// ==================== API 实现 ====================

export class ApiNotificationsRepository implements NotificationsRepository {
  async list(params: ListNotificationsParams = {}): Promise<ListNotificationsResponse> {
    const qs = new URLSearchParams();
    appendQueryParam(qs, 'page', params.page);
    appendQueryParam(qs, 'limit', params.limit);
    appendQueryParam(qs, 'is_read', params.is_read);
    appendQueryParam(qs, 'type', params.type);
    
    const url = qs.size 
      ? `${API_ENDPOINTS.NOTIFICATIONS.LIST}?${qs.toString()}` 
      : API_ENDPOINTS.NOTIFICATIONS.LIST;
    
    const res = await httpAuth.get<ApiResponse<ListNotificationsResponse>>(url);
    return unwrapApiResponse<ListNotificationsResponse>(res);
  }

  async getUnreadCount(): Promise<UnreadCountResponse> {
    const res = await httpAuth.get<ApiResponse<UnreadCountResponse>>(
      API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT
    );
    return unwrapApiResponse<UnreadCountResponse>(res);
  }

  async markAsRead(notificationId: string): Promise<MarkReadResponse> {
    const url = API_ENDPOINTS.NOTIFICATIONS.MARK_READ.replace(
      ':notificationId',
      encodeURIComponent(notificationId)
    );
    const res = await httpAuth.put<ApiResponse<null>>(url, {});
    unwrapApiResponse<null>(res);
  }

  async markAllAsRead(): Promise<MarkAllReadResponse> {
    const res = await httpAuth.put<ApiResponse<MarkAllReadResponse>>(
      API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ, 
      {}
    );
    return unwrapApiResponse<MarkAllReadResponse>(res);
  }
}

// ==================== 导出 ====================

export const notificationsRepository: NotificationsRepository = new ApiNotificationsRepository();

