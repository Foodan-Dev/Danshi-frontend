import React, { useEffect, useState, useMemo } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl, Alert, Pressable, Image } from 'react-native';
import { Appbar, Text, useTheme as usePaperTheme, Button, Card, Menu } from 'react-native-paper';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/src/hooks/use_responsive';
import { pickByBreakpoint } from '@/src/constants/breakpoints';
import { useAuth } from '@/src/context/auth_context';
import { isAdmin } from '@/src/lib/auth/roles';
import { adminService } from '@/src/services/admin_service';
import type { AdminCommentSummary } from '@/src/repositories/admin_repository';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getSafeRemoteUrl } from '@/src/lib/security/url';

// 格式化时间：显示为 MM-DD HH:mm
const formatTime = (dateStr: string) => {
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${minute}`;
};

export default function AdminCommentsScreen() {
  const pTheme = usePaperTheme();
  const insets = useSafeAreaInsets();
  const { current } = useResponsive();
  const { user } = useAuth();

  const [comments, setComments] = useState<AdminCommentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [menuVisible, setMenuVisible] = useState<string | null>(null);

  const contentHorizontalPadding = pickByBreakpoint(current, { base: 12, sm: 16, md: 20, lg: 24, xl: 24 });

  // 获取扩展的主题色
  const colors = pTheme.colors as typeof pTheme.colors & {
    surfaceContainer: string;
    surfaceContainerHigh: string;
  };

  // 动态样式
  const dynamicStyles = useMemo(() => ({
    commentCard: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 12,
      padding: 14,
      marginBottom: 8,
    },
    userName: {
      fontSize: 15,
      fontWeight: '600' as const,
      color: pTheme.colors.onSurface,
    },
    userEmail: {
      fontSize: 11,
      color: pTheme.colors.onSurfaceVariant,
      marginTop: 2,
    },
    timeText: {
      fontSize: 12,
      color: pTheme.colors.onSurfaceVariant,
    },
    contentText: {
      fontSize: 15,
      lineHeight: 22,
      color: pTheme.colors.onSurface,
    },
    replyName: {
      fontSize: 15,
      fontWeight: '500' as const,
      color: pTheme.colors.primary, // 品牌色
    },
    sourceCard: {
      backgroundColor: colors.surfaceContainerHigh,
      borderRadius: 8,
      padding: 12,
      marginTop: 12,
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
    },
    sourceText: {
      flex: 1,
      fontSize: 12,
      color: pTheme.colors.onSurfaceVariant,
      marginLeft: 8,
    },
  }), [pTheme.colors, colors]);

  // 权限检查
  if (!user || !isAdmin(user.role)) {
    return (
      <View style={{ flex: 1, backgroundColor: pTheme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text>无权访问</Text>
      </View>
    );
  }

  const loadComments = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    
    try {
      const result = await adminService.getComments({});
      setComments(result.comments);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadComments();
  }, []);

  const handleDelete = async (commentId: string) => {
    try {
      await adminService.deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const confirmDelete = (commentId: string) => {
    Alert.alert(
      '删除评论',
      '确定要删除这条评论吗？此操作不可撤销。',
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '删除', 
          style: 'destructive',
          onPress: () => handleDelete(commentId)
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: pTheme.colors.background }}>
      <Appbar.Header mode="center-aligned" statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="评论管理" />
      </Appbar.Header>

      <ScrollView
        style={{ backgroundColor: pTheme.colors.background }}
        contentContainerStyle={{ 
          paddingTop: 12, 
          paddingBottom: 24, 
          paddingHorizontal: contentHorizontalPadding,
        }}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => loadComments(true)}
            colors={[pTheme.colors.primary]}
            tintColor={pTheme.colors.primary}
            progressBackgroundColor={pTheme.colors.surface}
          />
        }
      >
        {loading && comments.length === 0 ? (
          <Card mode="contained">
            <Card.Content style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text>加载中...</Text>
            </Card.Content>
          </Card>
        ) : error ? (
          <Card mode="contained">
            <Card.Content style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ color: pTheme.colors.error }}>{error}</Text>
              <Button mode="text" onPress={() => loadComments()} style={{ marginTop: 8 }}>
                重试
              </Button>
            </Card.Content>
          </Card>
        ) : comments.length === 0 ? (
          <Card mode="contained">
            <Card.Content style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="chatbox-outline" size={48} color={pTheme.colors.onSurfaceDisabled} />
              <Text style={{ marginTop: 12, color: pTheme.colors.onSurfaceVariant }}>暂无评论</Text>
            </Card.Content>
          </Card>
        ) : (
          comments.map((comment) => {
            const safeAuthorAvatarUrl = getSafeRemoteUrl((comment.author as any).avatar_url);
            return (
              <View key={comment.id} style={dynamicStyles.commentCard}>
                {/* 区域 A：头部 - 用户信息 */}
                <View style={styles.headerRow}>
                  {/* 左侧：头像 + 用户信息 */}
                  <View style={styles.userInfo}>
                    {/* 头像 32dp */}
                    <View style={[styles.avatar, { backgroundColor: pTheme.colors.surfaceVariant }]}>
                      {safeAuthorAvatarUrl ? (
                        <Image
                          source={{ uri: safeAuthorAvatarUrl }}
                          style={styles.avatarImage}
                        />
                      ) : (
                        <Ionicons name="person" size={16} color={pTheme.colors.onSurfaceVariant} />
                      )}
                    </View>
                    {/* 用户名和邮箱 */}
                    <View style={styles.userTextContainer}>
                      <Text style={dynamicStyles.userName}>{comment.author.name}</Text>
                      <Text style={dynamicStyles.userEmail} numberOfLines={1}>
                        {comment.author.email || `ID: ${comment.author.id.slice(0, 8)}...`}
                      </Text>
                    </View>
                  </View>

                  {/* 右侧：时间 + 菜单 */}
                  <View style={styles.headerRight}>
                    <Text style={dynamicStyles.timeText}>{formatTime(comment.created_at)}</Text>
                    <Menu
                      visible={menuVisible === comment.id}
                      onDismiss={() => setMenuVisible(null)}
                      anchor={
                        <Pressable
                          style={styles.menuBtn}
                          onPress={() => setMenuVisible(comment.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="ellipsis-vertical" size={16} color={pTheme.colors.onSurfaceVariant} />
                        </Pressable>
                      }
                    >
                      <Menu.Item
                        onPress={() => {
                          setMenuVisible(null);
                          router.push(`/post/${comment.post_id}`);
                        }}
                        title="查看帖子"
                        leadingIcon="eye"
                      />
                      <Menu.Item
                        onPress={() => {
                          setMenuVisible(null);
                          confirmDelete(comment.id);
                        }}
                        title="删除"
                        leadingIcon="delete"
                        titleStyle={{ color: pTheme.colors.error }}
                      />
                    </Menu>
                  </View>
                </View>

                {/* 区域 B：评论主体 */}
                <View style={styles.contentSection}>
                  {comment.parent_id ? (
                    // 回复某人的评论
                    <Text style={dynamicStyles.contentText}>
                      <Text style={{ color: pTheme.colors.onSurfaceVariant }}>回复 </Text>
                      <Text style={dynamicStyles.replyName}>@{(comment as any).parent_author_name || '用户'}</Text>
                      <Text style={{ color: pTheme.colors.onSurfaceVariant }}> : </Text>
                      {comment.content}
                    </Text>
                  ) : (
                    <Text style={dynamicStyles.contentText}>{comment.content}</Text>
                  )}
                </View>

                {/* 区域 C：来源上下文 - 引用卡片 */}
                <Pressable
                  style={dynamicStyles.sourceCard}
                  onPress={() => router.push(`/post/${comment.post_id}`)}
                >
                  <Ionicons name="document-text-outline" size={16} color={pTheme.colors.onSurfaceVariant} />
                  <Text style={dynamicStyles.sourceText} numberOfLines={1}>
                    来自帖子: {(comment as any).post_title || '查看原帖...'}
                  </Text>
                  <Ionicons name="chevron-forward" size={14} color={pTheme.colors.outline} />
                </Pressable>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // 区域 A：头部
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  userTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  menuBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // 区域 B：评论主体
  contentSection: {
    marginTop: 12,
    paddingLeft: 42, // 与用户名对齐（头像32 + marginLeft 10）
  },
});
