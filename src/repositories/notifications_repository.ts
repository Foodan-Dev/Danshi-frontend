import type { components } from '@/src/generated/openapi';
import { AppError } from '@/src/lib/errors/app_error';
import { httpAuth } from '@/src/lib/http/http_auth';
import { unwrapApiResponse, type ApiResponse } from '@/src/lib/http/response';
import { API_ENDPOINTS } from '@/src/constants/app';
import { requireNumber, requireString, toCursorPagination, type CursorPagination } from '@/src/repositories/api_mappers';

export type NotificationType =
  | 'comment'
  | 'reply'
  | 'like_post'
  | 'like_comment'
  | 'follow'
  | 'mention';

export type NotificationRelatedType = 'post' | 'comment';

export type NotificationSender = {
  id: number;
  name: string;
  avatar_url?: string | null;
};

export type Notification = {
  id: number;
  type: NotificationType;
  sender: NotificationSender;
  related_id?: number | null;
  related_type?: NotificationRelatedType | null;
  post_id?: number | null;
  content?: string | null;
  is_read: boolean;
  created_at: string;
};

export type ListNotificationsParams = {
  cursor?: string;
  limit?: number;
  is_read?: boolean;
  type?: NotificationType;
};
export type ListNotificationsResponse = {
  notifications: Notification[];
  pagination: CursorPagination;
  unread_count: number;
};
export type UnreadCountResponse = { unread_count: number };
export type MarkReadResponse = void;
export type MarkAllReadResponse = { marked_count: number };

const appendQueryParam = (qs: URLSearchParams, key: string, value: unknown) => {
  if (value == null) return;
  qs.set(key, typeof value === 'boolean' ? String(value) : String(value).trim());
};

const toNotification = (item: components['schemas']['NotificationItem']): Notification => {
  if (!item.sender) throw new AppError('服务端响应缺少通知发送者');
  if (!item.type) throw new AppError('服务端响应缺少通知类型');
  return {
    id: requireNumber(item.id, '通知 ID'),
    type: item.type,
    sender: {
      id: requireNumber(item.sender.id, '通知发送者 ID'),
      name: requireString(item.sender.name, '通知发送者名称'),
      avatar_url: item.sender.avatar_url ?? null,
    },
    related_id: item.related_id ?? null,
    related_type: item.related_type === 'post' || item.related_type === 'comment'
      ? item.related_type
      : null,
    post_id: item.post_id ?? null,
    content: item.content ?? null,
    is_read: item.is_read ?? false,
    created_at: requireString(item.created_at, '通知创建时间'),
  };
};

export interface NotificationsRepository {
  list(params?: ListNotificationsParams): Promise<ListNotificationsResponse>;
  getUnreadCount(): Promise<UnreadCountResponse>;
  markAsRead(notificationId: number): Promise<MarkReadResponse>;
  markAllAsRead(): Promise<MarkAllReadResponse>;
}

export class ApiNotificationsRepository implements NotificationsRepository {
  async list(params: ListNotificationsParams = {}): Promise<ListNotificationsResponse> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => appendQueryParam(qs, key, value));
    const url = qs.size
      ? `${API_ENDPOINTS.NOTIFICATIONS.LIST}?${qs.toString()}`
      : API_ENDPOINTS.NOTIFICATIONS.LIST;
    const res = await httpAuth.get<ApiResponse<components['schemas']['NotificationList']>>(url);
    const data = unwrapApiResponse(res);
    return {
      notifications: (data.notifications ?? []).map(toNotification),
      pagination: toCursorPagination(data.pagination),
      unread_count: data.unread_count ?? 0,
    };
  }

  async getUnreadCount(): Promise<UnreadCountResponse> {
    const res = await httpAuth.get<ApiResponse<components['schemas']['NotificationStats']>>(
      API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT,
    );
    return { unread_count: unwrapApiResponse(res).unread_count ?? 0 };
  }

  async markAsRead(notificationId: number): Promise<MarkReadResponse> {
    const url = API_ENDPOINTS.NOTIFICATIONS.MARK_READ.replace(
      ':notificationId',
      encodeURIComponent(String(notificationId)),
    );
    unwrapApiResponse(await httpAuth.put<ApiResponse<null>>(url, {}));
  }

  async markAllAsRead(): Promise<MarkAllReadResponse> {
    const res = await httpAuth.put<ApiResponse<components['schemas']['NotificationMarked']>>(
      API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ,
      {},
    );
    return { marked_count: unwrapApiResponse(res).marked_count ?? 0 };
  }
}

export const notificationsRepository: NotificationsRepository = new ApiNotificationsRepository();
