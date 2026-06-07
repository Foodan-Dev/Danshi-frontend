import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ScrollView, Image, RefreshControl, Pressable, Alert } from 'react-native';
import { ActivityIndicator, Appbar, Card, Text, useTheme as usePaperTheme, Button, Menu } from 'react-native-paper';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/src/hooks/use_responsive';
import { pickByBreakpoint } from '@/src/constants/breakpoints';
import { useAuth } from '@/src/context/auth_context';
import { isAdmin } from '@/src/lib/auth/roles';
import { adminService } from '@/src/services/admin_service';
import type { AdminPendingPostSummary } from '@/src/repositories/admin_repository';
import Ionicons from '@expo/vector-icons/Ionicons';
import { formatDate } from '@/src/utils/time_format';
import { getSafeRemoteUrl } from '@/src/lib/security/url';

export default function AdminPostsScreen() {
  const pTheme = usePaperTheme();
  const insets = useSafeAreaInsets();
  const { current } = useResponsive();
  const { user, isLoading } = useAuth();

  const [posts, setPosts] = useState<AdminPendingPostSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [menuVisible, setMenuVisible] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const contentHorizontalPadding = pickByBreakpoint(current, { base: 12, sm: 16, md: 20, lg: 24, xl: 24 });

  // 动态样式 - 基于主题
  // 获取扩展的主题色（在 md3_theme.ts 中定义）
  const colors = pTheme.colors as typeof pTheme.colors & {
    surfaceContainer: string;
    surfaceContainerHigh: string;
  };

  const dynamicStyles = useMemo(() => ({
    listTile: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 12,
      padding: 12,
      minHeight: 80,
      marginBottom: 8,
    },
    titleText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '700' as const,
      color: pTheme.colors.onSurface,
    },
    summaryText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: pTheme.colors.onSurfaceVariant,
    },
    metaText: {
      fontSize: 11,
      color: pTheme.colors.onSurfaceVariant,
    },
    metaSeparator: {
      fontSize: 11,
      color: pTheme.colors.outline,
      marginHorizontal: 2,
    },
    imageCountText: {
      color: pTheme.colors.onSurface,
      fontSize: 9,
      fontWeight: '600' as const,
    },
    typeTagSeeking: {
      backgroundColor: pTheme.colors.primaryContainer,
    },
    typeTagShare: {
      backgroundColor: pTheme.colors.secondaryContainer,
    },
    typeTagText: {
      fontSize: 10,
      color: pTheme.colors.onSurfaceVariant,
      fontWeight: '500' as const,
    },
  }), [colors.surfaceContainer, pTheme.colors]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/myself/admin');
  }, []);

  const loadPosts = useCallback(async (isRefresh = false) => {
    if (!user || !isAdmin(user.role)) return;
    const requestId = ++requestSeqRef.current;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError('');

    try {
      const result = await adminService.getPosts({});
      if (requestSeqRef.current !== requestId) {
        return;
      }
      setPosts(result.posts);
    } catch (e) {
      if (requestSeqRef.current !== requestId) {
        return;
      }
      setLoadError(e instanceof Error ? e.message : '读取帖子失败，请稍后重试');
    } finally {
      if (requestSeqRef.current === requestId) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (isLoading || !user || !isAdmin(user.role)) {
      return;
    }
    void loadPosts();
  }, [isLoading, loadPosts, user]);

  const handleReview = async (post_id: string, action: 'approve' | 'reject') => {
    setActionError('');
    try {
      await adminService.reviewPost(post_id, { status: action === 'approve' ? 'approved' : 'rejected' });
      await loadPosts();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '审核帖子失败，请稍后重试');
    }
  };

  const handleDelete = async (post_id: string) => {
    setActionError('');
    try {
      await adminService.deletePost(post_id);
      setPosts((prev) => prev.filter((p) => p.id !== post_id));
    } catch (e) {
      setActionError(e instanceof Error ? e.message : '删除帖子失败，请稍后重试');
    }
  };

  // 确认删除
  const confirmDelete = (post_id: string, title: string) => {
    Alert.alert(
      '删除帖子',
      `确定要删除「${title}」吗？此操作不可撤销。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: () => handleDelete(post_id)
        },
      ]
    );
  };

  // 确认审核
  const confirmReview = (post_id: string, action: 'approve' | 'reject', title: string) => {
    const actionText = action === 'approve' ? '通过' : '拒绝';
    Alert.alert(
      `${actionText}帖子`,
      `确定要${actionText}「${title}」吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: actionText,
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: () => handleReview(post_id, action)
        },
      ]
    );
  };

  // 状态颜色：绿色=已通过，橙色=待审核，红色=已拒绝
  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'approved': return pTheme.colors.tertiary;
      case 'pending': return pTheme.colors.primary;
      case 'rejected': return pTheme.colors.error;
      default: return pTheme.colors.outline;
    }
  };

  // 格式化时间（使用统一工具函数）
  const formatShortDate = (dateStr: string) => formatDate(dateStr, 'short');

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: pTheme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator animating size="large" color={pTheme.colors.primary} />
        <Text style={{ marginTop: 12, color: pTheme.colors.onSurfaceVariant }}>正在校验管理员权限...</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, backgroundColor: pTheme.colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ color: pTheme.colors.onSurface, marginBottom: 12 }}>请先登录后再访问帖子管理</Text>
        <Button mode="contained" onPress={() => router.replace('/login')} style={{ borderRadius: 10 }}>
          去登录
        </Button>
      </View>
    );
  }

  if (!isAdmin(user.role)) {
    return (
      <View style={{ flex: 1, backgroundColor: pTheme.colors.background, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
        <Text style={{ color: pTheme.colors.onSurface, marginBottom: 8 }}>当前账号没有帖子管理权限</Text>
        <Text style={{ color: pTheme.colors.onSurfaceVariant, marginBottom: 12 }}>请返回管理中心或切换为管理员账号</Text>
        <Button mode="contained-tonal" onPress={handleBack} style={{ borderRadius: 10 }}>
          返回
        </Button>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: pTheme.colors.background }}>
      <Appbar.Header mode="center-aligned" statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={handleBack} />
        <Appbar.Content title="帖子管理" />
      </Appbar.Header>

      <ScrollView
        style={{ backgroundColor: pTheme.colors.background }}
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: 24,
          paddingHorizontal: contentHorizontalPadding,
          gap: 8
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void loadPosts(true)}
            colors={[pTheme.colors.primary]}
            tintColor={pTheme.colors.primary}
            progressBackgroundColor={pTheme.colors.surface}
          />
        }
      >
        {loading && posts.length === 0 ? (
          <Card mode="contained">
            <Card.Content style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text>加载中...</Text>
            </Card.Content>
          </Card>
        ) : loadError && posts.length === 0 ? (
          <Card mode="contained">
            <Card.Content style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ color: pTheme.colors.error }}>{loadError}</Text>
              <Button mode="text" onPress={() => void loadPosts()} style={{ marginTop: 8 }}>
                重试
              </Button>
            </Card.Content>
          </Card>
        ) : posts.length === 0 ? (
          <Card mode="contained">
            <Card.Content style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Ionicons name="document-text-outline" size={48} color={pTheme.colors.onSurfaceDisabled} />
              <Text style={{ marginTop: 12, color: pTheme.colors.onSurfaceVariant }}>暂无帖子</Text>
            </Card.Content>
          </Card>
        ) : (
          <>
            {loadError ? (
              <Card mode="contained" style={{ marginBottom: 8 }}>
                <Card.Content>
                  <Text style={{ color: pTheme.colors.error }}>刷新失败，当前展示的是旧列表：{loadError}</Text>
                </Card.Content>
              </Card>
            ) : null}
            {actionError ? (
              <Card mode="contained" style={{ marginBottom: 8 }}>
                <Card.Content>
                  <Text style={{ color: pTheme.colors.error }}>{actionError}</Text>
                </Card.Content>
              </Card>
            ) : null}
            {posts.map((post) => {
              const safePreviewImage = post.images?.map((item) => getSafeRemoteUrl(item)).find((item): item is string => !!item);
              const hasImage = !!safePreviewImage;
              const statusDotColor = getStatusDotColor(post.status);
              const isPending = post.status === 'pending';

              return (
                <Pressable
                  key={post.id}
                  onPress={() => router.push(`/post/${post.id}`)}
                  style={dynamicStyles.listTile}
                >
                  <View style={styles.topRow}>
                    <View style={[styles.statusDot, { backgroundColor: statusDotColor }]} />
                    <Text style={dynamicStyles.titleText} numberOfLines={1}>
                      {post.title}
                    </Text>
                    <Menu
                      visible={menuVisible === post.id}
                      onDismiss={() => setMenuVisible(null)}
                      anchor={
                        <Pressable
                          style={styles.moreBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            setMenuVisible(post.id);
                          }}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Ionicons name="ellipsis-vertical" size={18} color={pTheme.colors.onSurfaceVariant} />
                        </Pressable>
                      }
                    >
                      {isPending && (
                        <>
                          <Menu.Item
                            onPress={() => {
                              setMenuVisible(null);
                              confirmReview(post.id, 'approve', post.title);
                            }}
                            title="通过"
                            leadingIcon="check-circle"
                          />
                          <Menu.Item
                            onPress={() => {
                              setMenuVisible(null);
                              confirmReview(post.id, 'reject', post.title);
                            }}
                            title="拒绝"
                            leadingIcon="close-circle"
                          />
                        </>
                      )}
                      <Menu.Item
                        onPress={() => {
                          setMenuVisible(null);
                          router.push(`/post/${post.id}`);
                        }}
                        title="查看详情"
                        leadingIcon="eye"
                      />
                      <Menu.Item
                        onPress={() => {
                          setMenuVisible(null);
                          confirmDelete(post.id, post.title);
                        }}
                        title="删除"
                        leadingIcon="delete"
                        titleStyle={{ color: pTheme.colors.error }}
                      />
                    </Menu>
                  </View>

                  <View style={styles.contentRow}>
                    <Text
                      style={[dynamicStyles.summaryText, hasImage && styles.summaryTextWithImage]}
                      numberOfLines={2}
                    >
                      {post.content}
                    </Text>
                    {hasImage && (
                      <View style={styles.thumbnailWrap}>
                        <Image
                          source={{ uri: safePreviewImage }}
                          style={styles.thumbnail}
                          resizeMode="cover"
                        />
                        {post.images!.length > 1 && (
                          <View style={styles.imageCount}>
                            <Text style={dynamicStyles.imageCountText}>{post.images!.length}</Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>

                  <View style={styles.metaRow}>
                    <View style={styles.metaLeft}>
                      <Ionicons name="person-outline" size={11} color={pTheme.colors.onSurfaceVariant} />
                      <Text style={dynamicStyles.metaText}>{post.author?.name || '未知'}</Text>
                      <Text style={dynamicStyles.metaSeparator}>·</Text>
                      <Ionicons name="time-outline" size={11} color={pTheme.colors.onSurfaceVariant} />
                      <Text style={dynamicStyles.metaText}>{formatShortDate(post.created_at)}</Text>
                    </View>
                    <View style={[
                      styles.typeTag,
                      post.post_type === 'seeking' ? dynamicStyles.typeTagSeeking : dynamicStyles.typeTagShare
                    ]}>
                      <Text style={dynamicStyles.typeTagText}>
                        {post.post_type === 'seeking' ? '求推荐' : '分享'}
                      </Text>
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // 顶部行：状态点 + 标题 + 菜单
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  // 中间行
  contentRow: {
    flexDirection: 'row',
    marginTop: 8,
    gap: 10,
  },
  summaryTextWithImage: {
    flex: 1,
  },

  // 缩略图
  thumbnailWrap: {
    width: 64,
    height: 64,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  imageCount: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },

  // 底部行
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },

  // 更多按钮（在顶部行最右侧）
  moreBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
});
