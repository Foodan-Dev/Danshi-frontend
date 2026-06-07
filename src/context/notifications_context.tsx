import React, { createContext, useContext, useCallback, useEffect, useState, useRef, type PropsWithChildren } from 'react';
import { notificationsService } from '@/src/services/notifications_service';
import { useAuth } from '@/src/context/auth_context';

// ==================== 类型定义 ====================

type NotificationsContextValue = {
  /** 未读通知数量 */
  unreadCount: number;
  /** 是否正在加载 */
  loading: boolean;
  /** 刷新未读数量 */
  refreshUnreadCount: () => Promise<void>;
  /** 减少未读数量（乐观更新） */
  decrementUnreadCount: () => void;
  /** 清零未读数量（全部已读后） */
  clearUnreadCount: () => void;
};

// ==================== Context ====================

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

// ==================== Provider ====================

/** 轮询间隔（毫秒）：60秒 */
const POLL_INTERVAL = 60 * 1000;

export function NotificationsProvider({ children }: PropsWithChildren) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeUserIdRef = useRef<string | null>(user?.id ?? null);
  const requestSeqRef = useRef(0);
  const activeRequestRef = useRef<Promise<void> | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    const currentUserId = activeUserIdRef.current;
    if (!currentUserId) {
      requestSeqRef.current += 1;
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    if (activeRequestRef.current) {
      await activeRequestRef.current;
      if (activeUserIdRef.current !== currentUserId) {
        return;
      }
    }

    const requestId = ++requestSeqRef.current;
    let request: Promise<void> | null = null;
    request = (async () => {
      setLoading(true);
      try {
        const { unread_count } = await notificationsService.getUnreadCount();
        if (requestSeqRef.current !== requestId || activeUserIdRef.current !== currentUserId) {
          return;
        }
        setUnreadCount(unread_count);
      } catch (error) {
        if (requestSeqRef.current !== requestId || activeUserIdRef.current !== currentUserId) {
          return;
        }
        if (__DEV__) console.warn('[NotificationsContext] Failed to fetch unread count:', error);
      } finally {
        if (requestSeqRef.current === requestId) {
          setLoading(false);
        }
        if (activeRequestRef.current === request) {
          activeRequestRef.current = null;
        }
      }
    })();
    activeRequestRef.current = request;
    await request;
  }, []);

  const decrementUnreadCount = useCallback(() => {
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  const clearUnreadCount = useCallback(() => {
    setUnreadCount(0);
  }, []);

  // 登录后立即获取未读数量，并启动轮询
  useEffect(() => {
    activeUserIdRef.current = user?.id ?? null;
    if (user?.id) {
      void refreshUnreadCount();
      
      // 启动轮询
      intervalRef.current = setInterval(() => {
        void refreshUnreadCount();
      }, POLL_INTERVAL);
    } else {
      requestSeqRef.current += 1;
      activeRequestRef.current = null;
      setUnreadCount(0);
      setLoading(false);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [user?.id, refreshUnreadCount]);

  const value: NotificationsContextValue = {
    unreadCount,
    loading,
    refreshUnreadCount,
    decrementUnreadCount,
    clearUnreadCount,
  };

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

// ==================== Hook ====================

export function useNotifications(): NotificationsContextValue {
  const context = useContext(NotificationsContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return context;
}

// ==================== 工具函数：格式化未读数量显示 ====================

export function formatUnreadCount(count: number): string | null {
  if (count <= 0) return null;
  if (count > 99) return '99+';
  return String(count);
}
