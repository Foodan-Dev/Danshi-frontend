import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, RefreshControl, ScrollView } from 'react-native';
import { ActivityIndicator, Appbar, Text, useTheme as usePaperTheme, Chip, FAB, Dialog, Portal, Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import type { Href } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { useAuth } from '@/src/context/auth_context';
import { usersService } from '@/src/services/users_service';
import { postsService } from '@/src/services/posts_service';
import { AppError } from '@/src/lib/errors/app_error';
import { Masonry } from '@/src/components/md3/masonry';
import { useWaterfallSettings } from '@/src/context/waterfall_context';
import { useBreakpoint } from '@/src/hooks/use_responsive';
import { pickByBreakpoint } from '@/src/constants/breakpoints';
import { PostCard, estimatePostCardHeight } from '@/src/components/post_card';
import type { UserPostListItem } from '@/src/repositories/users_repository';
import { mapUserPostListItemToPost } from '@/src/utils/post_converters';

export const MyPostsScreen: React.FC = () => {
  const { user } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<UserPostListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const requestSeqRef = useRef(0);
  const insets = useSafeAreaInsets();
  const theme = usePaperTheme();
  // 本页会隐藏 TabBar，因此只按安全区预留底部空间
  const bottomContentPadding = useMemo(() => insets.bottom + 24, [insets.bottom]);

  const { minHeight, maxHeight } = useWaterfallSettings();
  const bp = useBreakpoint();
  // 与探索界面保持一致的响应式间距
  const gap = pickByBreakpoint(bp, { base: 4, sm: 6, md: 10, lg: 14, xl: 16 });
  const verticalGap = pickByBreakpoint(bp, { base: 4, sm: 6, md: 10, lg: 14, xl: 16 });
  const horizontalPadding = pickByBreakpoint(bp, { base: 4, sm: 6, md: 12, lg: 16, xl: 20 });

  const loadPosts = useCallback(
    async (isRefresh = false) => {
      if (!user?.id) return;
      const requestId = ++requestSeqRef.current;
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        const data = await usersService.getUserPosts(user.id);
        // 过滤掉不支持的帖子类型（如 companion）
        const supportedPosts = data.posts.filter((item: any) => 
          !item.post_type || item.post_type === 'share' || item.post_type === 'seeking'
        );
        if (requestSeqRef.current !== requestId) {
          return;
        }
        setPosts(supportedPosts);
      } catch (err: any) {
        if (requestSeqRef.current !== requestId) {
          return;
        }
        // 忽略 companion 类型相关的验证错误
        if (err?.message?.includes('companion') || err?.message?.includes('PostType')) {
          if (__DEV__) console.warn('后端返回了不支持的帖子类型，已忽略');
          setPosts([]);
        } else {
          const message = err instanceof AppError ? err.message : '读取数据失败，请稍后重试';
          setError(message);
        }
      } finally {
        if (requestSeqRef.current === requestId) {
          if (isRefresh) {
            setRefreshing(false);
          } else {
            setLoading(false);
          }
        }
      }
    },
    [user?.id],
  );

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) {
        return;
      }
      void loadPosts();
    }, [loadPosts, user?.id])
  );

  const estimateHeight = useCallback(
    (item: UserPostListItem) => {
      const post = mapUserPostListItemToPost(item);
      return estimatePostCardHeight(post, minHeight, maxHeight);
    },
    [maxHeight, minHeight]
  );

  const handlePostPress = useCallback(
    (postId: string) => {
      // 跳转到编辑页面（这里暂时跳转到详情页，后续可以改为编辑页）
      const href: Href = { pathname: '/post/[postId]', params: { postId } } as const;
      router.push(href);
    },
    [router]
  );

  const handleCreatePost = useCallback(() => {
    router.push('/post');
  }, [router]);

  const handleEditPost = useCallback(
    (postId: string) => {
      // 跳转到编辑页面
      const href: Href = { pathname: '/post/edit/[postId]', params: { postId } } as const;
      router.push(href);
    },
    [router]
  );

  const handleDeletePost = useCallback((postId: string) => {
    setPostToDelete(postId);
    setDeleteDialogVisible(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!postToDelete) return;
    
    setDeleting(true);
    try {
      await postsService.remove(postToDelete);
      // 从列表中移除该帖子
      setPosts(prev => prev.filter(p => p.id !== postToDelete));
      setDeleteDialogVisible(false);
      setPostToDelete(null);
      setError(null);
    } catch (err) {
      const message = err instanceof AppError ? err.message : '删除失败，请稍后重试';
      setError(message);
    } finally {
      setDeleting(false);
    }
  }, [postToDelete]);

  const cancelDelete = useCallback(() => {
    setDeleteDialogVisible(false);
    setPostToDelete(null);
  }, []);

  const content = useMemo(() => posts, [posts]);

  const renderPostCard = useCallback(
    (item: UserPostListItem) => {
      const post = mapUserPostListItemToPost(item);
      return (
        <PostCard
          post={post}
          onPress={handlePostPress}
          appearance="flat"
          showActions={true}
          onEdit={handleEditPost}
          onDelete={handleDeletePost}
          footer={
            item.status && item.status !== 'approved' ? (
              <View style={styles.statusFooter}>
                <Chip
                  compact
                  style={[
                    styles.statusChip,
                    {
                      backgroundColor:
                        item.status === 'pending'
                          ? theme.colors.secondaryContainer
                          : item.status === 'rejected'
                          ? theme.colors.errorContainer
                          : theme.colors.surfaceVariant,
                    },
                  ]}
                  textStyle={{
                    color:
                      item.status === 'pending'
                        ? theme.colors.onSecondaryContainer
                        : item.status === 'rejected'
                        ? theme.colors.onErrorContainer
                        : theme.colors.onSurfaceVariant,
                  }}
                >
                  {item.status === 'pending' ? '审核中' : item.status === 'rejected' ? '未通过' : '草稿'}
                </Chip>
              </View>
            ) : null
          }
        />
      );
    },
    [handlePostPress, handleEditPost, handleDeletePost, theme]
  );

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/myself');
  }, [router]);

  if (!user?.id) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Appbar.Header mode="center-aligned" statusBarHeight={insets.top}>
          <Appbar.BackAction onPress={handleBack} />
          <Appbar.Content title="我的帖子" />
        </Appbar.Header>
        <View style={styles.centered}>
          <Text variant="bodyMedium">请先登录后再查看我的帖子</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header mode="center-aligned" statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={handleBack} />
        <Appbar.Content title="我的帖子" />
      </Appbar.Header>
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator animating size="large" />
        </View>
      ) : error && posts.length === 0 ? (
        <ScrollView
          contentContainerStyle={[styles.emptyContainer, { paddingBottom: bottomContentPadding }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadPosts(true)}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
              progressBackgroundColor={theme.colors.surface}
              progressViewOffset={0}
            />
          }
        >
          <Text variant="bodyMedium" style={{ color: theme.colors.error, textAlign: 'center' }}>
            {error}
          </Text>
          <Button mode="contained-tonal" onPress={() => void loadPosts()} style={{ marginTop: 12 }}>
            重试
          </Button>
        </ScrollView>
      ) : posts.length === 0 ? (
        <ScrollView
          contentContainerStyle={[styles.emptyContainer, { paddingBottom: bottomContentPadding }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadPosts(true)}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
              progressBackgroundColor={theme.colors.surface}
              progressViewOffset={0}
            />
          }
        >
          <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
            还没有发布过帖子
          </Text>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingTop: 12, paddingBottom: bottomContentPadding }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadPosts(true)}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
              progressBackgroundColor={theme.colors.surface}
              progressViewOffset={0}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          <Masonry<UserPostListItem>
            data={content}
            columns={{ base: 2, md: 2, lg: 3, xl: 4 }}
            getItemHeight={estimateHeight}
            renderItem={renderPostCard}
            keyExtractor={(item) => item.id}
            gap={gap}
            verticalGap={verticalGap}
          />
        </ScrollView>
      )}
      {error ? (
        <View style={[styles.errorContainer, { bottom: insets.bottom + 16 }]}
        >
          <Text variant="bodySmall" style={{ color: theme.colors.error }}>
            {error}
          </Text>
        </View>
      ) : null}
      <FAB
        icon="plus"
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        onPress={handleCreatePost}
        label="发帖"
      />
      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={cancelDelete}>
          <Dialog.Title>删除帖子</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">确定要删除这篇帖子吗？此操作不可恢复。</Text>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={cancelDelete} disabled={deleting}>取消</Button>
            <Button onPress={confirmDelete} loading={deleting} buttonColor={theme.colors.error}>删除</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyContainer: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  statusFooter: {
    marginTop: 8,
  },
  statusChip: {
    alignSelf: 'flex-start',
  },
  errorContainer: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: 16,
  },
});

export default MyPostsScreen;
