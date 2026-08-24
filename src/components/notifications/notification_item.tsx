import React, { useCallback } from 'react';
import { View, Pressable, StyleSheet, Alert, type GestureResponderEvent } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';

import type { Notification } from '@/src/repositories/notifications_repository';
import { notificationsService } from '@/src/services/notifications_service';
import { formatRelativeTime } from '@/src/utils/time_format';
import { useNotifications } from '@/src/context/notifications_context';
import { CachedAvatar } from '@/src/components/cached_avatar';

// ==================== Props ====================

interface NotificationItemProps {
  notification: Notification;
  /** 乐观更新回调：同步通知已读状态 */
  onReadStateChange?: (notificationId: number, isRead: boolean) => void;
  isFollowing: boolean;
  followLoading: boolean;
  onFollowToggle: (userId: number) => void;
}

// ==================== Component ====================

export function NotificationItem({
  notification,
  onReadStateChange,
  isFollowing,
  followLoading,
  onFollowToggle,
}: NotificationItemProps) {
  const theme = useTheme();
  const { decrementUnreadCount, refreshUnreadCount } = useNotifications();

  const { id, type, sender, content, is_read, created_at, related_type } = notification;

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
        params: {
          postId: String(notification.post_id),
          scrollTo: 'comment',
          commentId: String(notification.related_id),
        },
      } as Href);
      return;
    }

    // 评论帖子通知：进入帖子并滚动到评论区
    if (notification.type === 'comment' && notification.related_type === 'post' && (notification.related_id || notification.post_id)) {
      router.push({
        pathname: '/post/[postId]',
        params: { postId: String(notification.related_id || notification.post_id), scrollTo: 'comments' },
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
  const handleFollowPress = useCallback(() => {
    if (followLoading) return;
    onFollowToggle(sender.id);
  }, [followLoading, onFollowToggle, sender.id]);

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
          <CachedAvatar uri={sender.avatar_url} size={44} style={{ opacity: readOpacity }} iconSize={20} />
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
