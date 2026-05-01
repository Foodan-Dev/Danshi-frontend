import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  Pressable,
  RefreshControl,
  Animated,
} from 'react-native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import type { Notification, NotificationType, ListNotificationsParams } from '@/src/repositories/notifications_repository';
import { notificationsService } from '@/src/services/notifications_service';
import { NotificationItem } from '@/src/components/notifications/notification_item';
import { useNotifications } from '@/src/context/notifications_context';

// ==================== 类型定义 ====================

type TabValue = 'all' | 'interactions' | 'follow';

interface Tab {
  value: TabValue;
  label: string;
  types: NotificationType[] | null; // null 表示全部
}

const TABS: Tab[] = [
  { value: 'all', label: '全部', types: null },
  { value: 'interactions', label: '互动', types: ['like_post', 'like_comment', 'comment', 'reply', 'mention'] },
  { value: 'follow', label: '关注', types: ['follow'] },
];

const PAGE_SIZE = 20;
const INTERACTION_TYPES: NotificationType[] = ['like_post', 'like_comment', 'comment', 'reply', 'mention'];

// ==================== 骨架屏组件 ====================

function SkeletonItem({ theme }: { theme: ReturnType<typeof useTheme> }) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 800, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [shimmerAnim]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  return (
    <View style={styles.skeletonItem}>
      <Animated.View
        style={[styles.skeletonAvatar, { backgroundColor: theme.colors.surfaceVariant, opacity }]}
      />
      <View style={styles.skeletonContent}>
        <Animated.View
          style={[styles.skeletonLine, { width: '60%', backgroundColor: theme.colors.surfaceVariant, opacity }]}
        />
        <Animated.View
          style={[styles.skeletonLine, { width: '40%', backgroundColor: theme.colors.surfaceVariant, opacity }]}
        />
      </View>
      <Animated.View
        style={[styles.skeletonThumbnail, { backgroundColor: theme.colors.surfaceVariant, opacity }]}
      />
    </View>
  );
}

function SkeletonList({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View>
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonItem key={i} theme={theme} />
      ))}
    </View>
  );
}

// ==================== 空状态组件 ====================

function EmptyState({ theme }: { theme: ReturnType<typeof useTheme> }) {
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={64} color={theme.colors.outline} />
      <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
        还没有新消息
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
        还没有人发现你的美食宝藏{'\n'}去发一条帖子吧！
      </Text>
      <Pressable
        style={[styles.emptyButton, { borderColor: theme.colors.primary }]}
        onPress={() => router.push('/post')}
      >
        <Text style={[styles.emptyButtonText, { color: theme.colors.primary }]}>
          发布帖子
        </Text>
      </Pressable>
    </View>
  );
}

// ==================== 主组件 ====================

export default function NotificationsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { clearUnreadCount, refreshUnreadCount } = useNotifications();

  // 状态
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSeq, setRefreshSeq] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const requestSeqRef = useRef(0);

  // 小圆点消失动画
  const dotsOpacity = useRef(new Animated.Value(1)).current;

  // 获取当前 Tab 的筛选类型
  const getCurrentTypeFilter = useCallback((tab: TabValue): NotificationType | undefined => {
    // 如果有多个类型，接口只支持单个 type，暂时不传（由前端筛选）
    // 这里简化处理：只有 follow tab 传 type
    if (tab === 'follow') return 'follow';
    return undefined;
  }, []);

  const filterNotificationsByTab = useCallback((tab: TabValue, data: Notification[]) => {
    if (tab === 'interactions') {
      return data.filter((item) => INTERACTION_TYPES.includes(item.type));
    }
    if (tab === 'follow') {
      return data.filter((item) => item.type === 'follow');
    }
    return data;
  }, []);

  // 加载通知列表
  const loadNotifications = useCallback(
    async (tab: TabValue, pageNum: number, isRefresh = false) => {
      const requestId = ++requestSeqRef.current;
      let currentPage = pageNum;
      let lastPagination: ListNotificationsResponse['pagination'] | null = null;
      let collected: Notification[] = [];

      try {
        setError(null);
        while (true) {
          const params: ListNotificationsParams = {
            page: currentPage,
            limit: PAGE_SIZE,
            type: getCurrentTypeFilter(tab),
          };
          const { notifications: data, pagination } = await notificationsService.list(params);
          if (requestSeqRef.current !== requestId) {
            return;
          }
          lastPagination = pagination;
          collected = collected.concat(filterNotificationsByTab(tab, data));
          const reachedPageEnd = pagination.page >= pagination.total_pages;
          if (tab !== 'interactions' || reachedPageEnd || collected.length >= PAGE_SIZE) {
            break;
          }
          currentPage += 1;
        }

        if (!lastPagination || requestSeqRef.current !== requestId) {
          return;
        }

        if (isRefresh || pageNum === 1) {
          setNotifications(collected);
        } else {
          setNotifications((prev) => [...prev, ...collected]);
        }

        setHasMore(lastPagination.page < lastPagination.total_pages);
        setPage(lastPagination.page);
      } catch (err) {
        if (requestSeqRef.current !== requestId) {
          return;
        }
        if (__DEV__) console.warn('[NotificationsScreen] Failed to load notifications:', err);
        // 仅首页加载失败时显示错误状态，加载更多失败不覆盖已有数据
        if (isRefresh || pageNum === 1) {
          setError((err as Error)?.message || '加载通知失败，请稍后重试');
        }
      }
    },
    [filterNotificationsByTab, getCurrentTypeFilter]
  );

  // 初始加载
  useEffect(() => {
    setLoading(true);
    setPage(1);
    loadNotifications(activeTab, 1, true).finally(() => setLoading(false));
  }, [activeTab, loadNotifications]);

  // 下拉刷新
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setRefreshSeq((prev) => prev + 1);
    await loadNotifications(activeTab, 1, true);
    await refreshUnreadCount();
    setRefreshing(false);
  }, [activeTab, loadNotifications, refreshUnreadCount]);

  // 加载更多
  const handleLoadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    await loadNotifications(activeTab, page + 1);
    setLoadingMore(false);
  }, [activeTab, loadingMore, hasMore, page, loadNotifications]);

  // 全部已读
  const handleMarkAllRead = useCallback(async () => {
    if (markAllLoading) return;
    setMarkAllLoading(true);

    // 播放小圆点消失动画
    Animated.timing(dotsOpacity, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start();

    try {
      await notificationsService.markAllAsRead();
      // 更新本地状态
      setNotifications((prev) =>
        prev.map((n) => (n.is_read ? n : { ...n, is_read: true }))
      );
      clearUnreadCount();
    } catch (error) {
      if (__DEV__) console.warn('[NotificationsScreen] Failed to mark all as read:', error);
      // 恢复动画
      dotsOpacity.setValue(1);
    } finally {
      setMarkAllLoading(false);
      // 动画完成后恢复
      setTimeout(() => dotsOpacity.setValue(1), 500);
    }
  }, [markAllLoading, clearUnreadCount, dotsOpacity]);

  // 单条标记已读（乐观更新）
  const handleMarkAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
    );
  }, []);

  // Tab 切换
  const handleTabChange = useCallback((tab: TabValue) => {
    if (tab === activeTab) return;
    setLoading(true); // 立即显示加载动画，避免闪现空状态
    setActiveTab(tab);
    setNotifications([]);
    setPage(1);
    setHasMore(true);
  }, [activeTab]);

  // 滑动切换 Tab
  const handleSwipeLeft = useCallback(() => {
    const currentIndex = TABS.findIndex((t) => t.value === activeTab);
    if (currentIndex < TABS.length - 1) {
      handleTabChange(TABS[currentIndex + 1].value);
    }
  }, [activeTab, handleTabChange]);

  const handleSwipeRight = useCallback(() => {
    const currentIndex = TABS.findIndex((t) => t.value === activeTab);
    if (currentIndex > 0) {
      handleTabChange(TABS[currentIndex - 1].value);
    }
  }, [activeTab, handleTabChange]);

  // 手势处理
  const panGesture = Gesture.Pan()
    .activeOffsetX([-20, 20]) // 水平滑动超过20才触发
    .failOffsetY([-10, 10]) // 垂直滑动超过10则失败（让垂直滚动优先）
    .onEnd((event) => {
      const { translationX, velocityX } = event;
      // 滑动距离超过50或速度超过500才切换
      if (translationX < -50 || velocityX < -500) {
        runOnJS(handleSwipeLeft)();
      } else if (translationX > 50 || velocityX > 500) {
        runOnJS(handleSwipeRight)();
      }
    });

  // 渲染列表项
  const renderItem = useCallback(
    ({ item }: { item: Notification }) => (
      <NotificationItem notification={item} onMarkAsRead={handleMarkAsRead} refreshKey={refreshSeq} />
    ),
    [handleMarkAsRead, refreshSeq]
  );

  // 列表底部
  const renderFooter = useCallback(() => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }, [loadingMore, theme.colors.primary]);

  // 检查是否有未读
  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      {/* 顶部栏 */}
      <View style={[styles.header, { borderBottomColor: theme.colors.outlineVariant }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => router.back()} hitSlop={8} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.onSurface} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.colors.onSurface }]}>通知</Text>
        </View>
        
        {/* 全部已读按钮 - 始终存在以保持布局稳定 */}
        <Pressable
          style={[styles.markAllBtn, { opacity: hasUnread ? 1 : 0.5 }]}
          onPress={handleMarkAllRead}
          disabled={markAllLoading || !hasUnread}
        >
          {markAllLoading ? (
            <ActivityIndicator size={16} color={theme.colors.primary} />
          ) : (
            <Text style={[styles.markAllText, { color: theme.colors.primary }]}>
              全部已读
            </Text>
          )}
        </Pressable>
      </View>

      {/* Tab 栏 */}
      <View style={[styles.tabBar, { borderBottomColor: theme.colors.outlineVariant }]}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.value}
            style={[
              styles.tabItem,
              activeTab === tab.value && [styles.tabItemActive, { borderBottomColor: theme.colors.primary }],
            ]}
            onPress={() => handleTabChange(tab.value)}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab.value ? theme.colors.primary : theme.colors.onSurfaceVariant },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* 内容区域 - 支持左右滑动切换Tab */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.contentArea}>
          {loading ? (
            <SkeletonList theme={theme} />
          ) : error ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cloud-offline-outline" size={56} color={theme.colors.outline} />
              <Text style={[styles.emptyTitle, { color: theme.colors.onSurface }]}>
                加载失败
              </Text>
              <Text style={[styles.emptySubtitle, { color: theme.colors.onSurfaceVariant }]}>
                {error}
              </Text>
              <Pressable
                style={[styles.emptyButton, { borderColor: theme.colors.primary }]}
                onPress={() => {
                  setLoading(true);
                  loadNotifications(activeTab, 1, true).finally(() => setLoading(false));
                }}
              >
                <Text style={[styles.emptyButtonText, { color: theme.colors.primary }]}>
                  重试
                </Text>
              </Pressable>
            </View>
          ) : notifications.length === 0 ? (
            <EmptyState theme={theme} />
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              ListFooterComponent={renderFooter}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.3}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={handleRefresh}
                  tintColor={theme.colors.primary}
                  colors={[theme.colors.primary]}
                  progressBackgroundColor={theme.colors.surface}
                />
              }
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          )}
        </View>
      </GestureDetector>
    </View>
  );
}

// ==================== Styles ====================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
  },
  listContent: {
    flexGrow: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 12, // 对齐内容区域
    marginRight: 12, // 对齐内容区域
  },
  footer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  // 骨架屏
  skeletonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  skeletonContent: {
    flex: 1,
    marginRight: 12,
  },
  skeletonLine: {
    height: 14,
    borderRadius: 7,
    marginBottom: 8,
  },
  skeletonThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  // 空状态
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  emptyButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
