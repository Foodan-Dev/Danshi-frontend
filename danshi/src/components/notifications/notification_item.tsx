import React, { useState, useCallback, useEffect } from 'react';
import { View, Pressable, StyleSheet, Image, Alert, type GestureResponderEvent } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import type { Notification } from '@/src/repositories/notifications_repository';
import { notificationsService } from '@/src/services/notifications_service';
import { usersService } from '@/src/services/users_service';
import { formatRelativeTime } from '@/src/utils/time_format';
import { useNotifications } from '@/src/context/notifications_context';
import { getSafeRemoteUrl } from '@/src/lib/security/url';

// ==================== Props ====================

interface NotificationItemProps {
  notification: Notification;
  /** 乐观更新回调：同步通知已读状态 */
  onReadStateChange?: (notificationId: string, isRead: boolean) => void;
  /** 刷新标记：父组件下拉刷新时递增 */
  refreshKey?: number;
}

// ==================== Component ====================

export function NotificationItem({ notification, onReadStateChange, refreshKey }: NotificationItemProps) {
  const theme = useTheme();
  const { decrementUnreadCount, refreshUnreadCount } = useNotifications();
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);

  const { id, type, sender, content, is_read, created_at, related_type } = notification;
  const safeSenderAvatarUrl = getSafeRemoteUrl(sender.avatar_url);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [safeSenderAvatarUrl]);

  // 对 follow 类型通知，检查是否已关注该用户
  const refreshFollowStatus = useCallback(() => {
    if (type !== 'follow') return;
    let cancelled = false;
    usersService.getUser(sender.id)
      .then((profile) => {
        if (!cancelled) {
          setIsFollowing(profile.is_following);
        }
      })
      .catch((e) => {
        if (__DEV__) console.warn('[NotificationItem] Failed to check follow status:', e);
      });
    return () => { cancelled = true; };
  }, [type, sender.id]);

  useEffect(() => refreshFollowStatus(), [refreshFollowStatus, refreshKey]);

  useFocusEffect(
    useCallback(() => {
      return refreshFollowStatus();
    }, [refreshFollowStatus])
  );

  // 获取动作文案
  const actionText = notificationsService.getNotificationTypeLabel(type);

  // 处理点击事件
  const handlePress = useCallback(() => {
    // 乐观更新：立即标记为已读
    if (!is_read) {
      onReadStateChange?.(id, true);
      decrementUnreadCount();
      notificationsService.markAsRead(id).catch((e) => {
        onReadStateChange?.(id, false);
        refreshUnreadCount().catch(() => {});
        if (__DEV__) console.warn('[NotificationItem] Failed to mark as read:', e);
      });
    }


    // 任何“关联到评论”的通知，优先定位到对应评论
    if (notification.related_type === 'comment' && notification.related_id && notification.post_id) {
      router.push({
        pathname: '/post/[postId]',
        params: { postId: notification.post_id, scrollTo: 'comment', commentId: notification.related_id },
      } as Href);
      return;
    }

    // 评论帖子通知：进入帖子并滚动到评论区
    if (notification.type === 'comment' && notification.related_type === 'post' && (notification.related_id || notification.post_id)) {
      router.push({
        pathname: '/post/[postId]',
        params: { postId: notification.related_id || notification.post_id || '', scrollTo: 'comments' },
      } as Href);
      return;
    }

    const route = notificationsService.getNotificationRoute(notification);
    if (route) {
      router.push(route as Href);
      return;
    }
    if (notification.related_type === 'comment') {
      Alert.alert('无法跳转', '该通知未包含帖子信息');
    }
  }, [id, is_read, onReadStateChange, decrementUnreadCount, refreshUnreadCount, notification]);

  // 处理头像点击
  const handleAvatarPress = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    router.push(`/user/${sender.id}`);
  }, [sender.id]);

  // 处理关注按钮点击
  const handleFollowPress = useCallback(async () => {
    if (followLoading) return;
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await usersService.unfollowUser(sender.id);
        setIsFollowing(false);
      } else {
        await usersService.followUser(sender.id);
        setIsFollowing(true);
      }
    } catch (e) {
      if (__DEV__) console.warn('[NotificationItem] Failed to toggle follow:', e);
    } finally {
      setFollowLoading(false);
    }
  }, [sender.id, isFollowing, followLoading]);

  const handleFollowButtonPress = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    void handleFollowPress();
  }, [handleFollowPress]);

  // 未读/已读样式
  const readOpacity = is_read ? 0.7 : 1;

  return (
    <Pressable
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: theme.colors.outlineVariant,
        },
      ]}
      onPress={handlePress}
      android_ripple={{ color: theme.colors.surfaceVariant }}
    >
      {/* 左侧：头像区域（含未读小圆点） */}
      <View style={styles.avatarWrapper}>
        {/* 未读小圆点 */}
        {!is_read && (
          <View style={[styles.unreadDot, { backgroundColor: theme.colors.primary }]} />
        )}
        <Pressable onPress={handleAvatarPress} style={styles.avatarContainer}>
          {safeSenderAvatarUrl && !avatarLoadFailed ? (
            <Image
              source={{ uri: safeSenderAvatarUrl }}
              style={[styles.avatar, { opacity: readOpacity }]}
              onError={() => setAvatarLoadFailed(true)}
            />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.surfaceVariant, opacity: readOpacity }]}>
              <Ionicons name="person" size={20} color={theme.colors.onSurfaceVariant} />
            </View>
          )}
        </Pressable>
      </View>

      {/* 中间：内容 */}
      <View style={[styles.content, { opacity: readOpacity }]}>
        {/* 第一行：用户名 + 动作 */}
        <Text style={styles.actionLine} numberOfLines={2}>
          <Text style={[styles.username, { color: theme.colors.onSurface }]}>{sender.name}</Text>
          <Text style={[styles.action, { color: theme.colors.onSurfaceVariant }]}> {actionText}</Text>
        </Text>

        {/* 评论/回复内容预览 */}
        {content && (type === 'comment' || type === 'reply' || type === 'mention') && (
          <Text
            style={[styles.contentPreview, { color: theme.colors.onSurfaceVariant }]}
            numberOfLines={2}
          >
            {'"'}
            {content}
            {'"'}
          </Text>
        )}

        {/* 时间 */}
        <Text style={[styles.time, { color: theme.colors.onSurfaceVariant }]}>
          {formatRelativeTime(created_at)}
        </Text>
      </View>

      {/* 右侧：关注按钮 或 缩略图 */}
      <View style={styles.rightSide}>
        {type === 'follow' ? (
          // 关注类型显示回关/互相关注按钮
          <Pressable
            style={[
              styles.followBtn,
              isFollowing
                ? { backgroundColor: theme.colors.surfaceVariant, borderWidth: 1, borderColor: theme.colors.outline }
                : { borderWidth: 1, borderColor: theme.colors.primary },
            ]}
            onPress={handleFollowButtonPress}
            disabled={followLoading}
          >
            <Text
              style={[
                styles.followBtnText,
                { color: isFollowing ? theme.colors.onSurfaceVariant : theme.colors.primary },
              ]}
            >
              {isFollowing ? '取关' : '回关'}
            </Text>
          </Pressable>
        ) : (related_type === 'post' || type === 'like_post' || type === 'comment' || type === 'reply' || type === 'mention') ? (
          // 帖子相关类型显示缩略图占位
          <View style={[styles.thumbnail, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Ionicons name="image-outline" size={20} color={theme.colors.outline} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// ==================== Styles ====================

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 96, // 统一最小高度，保证分割线间距一致
  },
  avatarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  avatarContainer: {
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    marginRight: 12,
  },
  actionLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  username: {
    fontWeight: '600',
  },
  action: {
    fontWeight: '400',
  },
  contentPreview: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  time: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 4,
  },
  rightSide: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
  },
  followBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
