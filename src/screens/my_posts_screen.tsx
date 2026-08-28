import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, RefreshControl, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ActivityIndicator, Appbar, Text, useTheme as usePaperTheme, Chip, FAB, Dialog, Portal, Button } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';

import { useAuth } from '@/src/context/auth_context';
import { usersService } from '@/src/services/users_service';
import { postsService } from '@/src/services/posts_service';
import { AppError } from '@/src/lib/errors/app_error';
import { useBreakpoint } from '@/src/hooks/use_responsive';
import { pickByBreakpoint } from '@/src/constants/breakpoints';
import { PostCard } from '@/src/components/post_card';
import type { UserPostListItem } from '@/src/repositories/users_repository';
import { mapUserPostListItemToPost } from '@/src/utils/post_converters';
import { getPostComposerHref } from '@/src/lib/navigation/post_composer';
import { usePostChangeSync } from '@/src/hooks/use_post_change_sync';
import { usePostChanges } from '@/src/context/post_changes_context';

const getPostId = (post: UserPostListItem) => post.id;
const mapChangedPost = (post: UserPostListItem) => post;

export const MyPostsScreen: React.FC = () => {
  const { user } = useAuth();
  const { reportPostChange } = usePostChanges();
  const router = useRouter();
  const [posts, setPosts] = useState<UserPostListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);
  const [postToDelete, setPostToDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const requestSeqRef = useRef(0);
  const insets = useSafeAreaInsets();
  const theme = usePaperTheme();
  // 本页会隐藏 TabBar，因此只按安全区预留底部空间
  const bottomContentPadding = useMemo(() => insets.bottom + 24, [insets.bottom]);

  const bp = useBreakpoint();
  // 与探索界面保持一致的响应式间距
  const gap = pickByBreakpoint(bp, { base: 4, sm: 6, md: 10, lg: 14, xl: 16 });
  const verticalGap = pickByBreakpoint(bp, { base: 4, sm: 6, md: 10, lg: 14, xl: 16 });
  const horizontalPadding = pickByBreakpoint(bp, { base: 4, sm: 6, md: 12, lg: 16, xl: 20 });
  const numColumns = pickByBreakpoint(bp, { base: 2, md: 2, lg: 3, xl: 4 });

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
        if (requestSeqRef.current !== requestId) {
          return;
        }
        setPosts(data.posts);
      } catch (err) {
        if (requestSeqRef.current !== requestId) {
          return;
        }
        const message = err instanceof AppError ? err.message : '读取数据失败，请稍后重试';
        setError(message);
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

  useEffect(() => {
    if (user?.id) void loadPosts();
  }, [loadPosts, user?.id]);

  usePostChangeSync({
    setItems: setPosts,
    getPostId,
    mapPost: mapChangedPost,
    insertNew: true,
  });

  const handlePostPress = useCallback(
    (postId: number) => {
      // 跳转到编辑页面（这里暂时跳转到详情页，后续可以改为编辑页）
      const href: Href = { pathname: '/post/[postId]', params: { postId: String(postId) } } as const;
      router.push(href);
    },
    [router]
  );

  const handleCreatePost = useCallback(() => {
    router.navigate(getPostComposerHref('/myself/posts'));
  }, [router]);

  const handleEditPost = useCallback(
    (postId: number) => {
      // 跳转到编辑页面
      const href: Href = { pathname: '/post/edit/[postId]', params: { postId: String(postId) } } as const;
      router.push(href);
    },
    [router]
  );

  const handleDeletePost = useCallback((postId: number) => {
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
      reportPostChange({ kind: 'delete', postId: postToDelete });
      setDeleteDialogVisible(false);
      setPostToDelete(null);
      setError(null);
    } catch (err) {
      const message = err instanceof AppError ? err.message : '删除失败，请稍后重试';
      setError(message);
    } finally {
      setDeleting(false);
    }
  }, [postToDelete, reportPostChange]);

  const cancelDelete = useCallback(() => {
    setDeleteDialogVisible(false);
    setPostToDelete(null);
  }, []);

  const content = useMemo(() => posts, [posts]);

  const renderPostCard = useCallback(
    ({ item }: { item: UserPostListItem }) => {
      const post = mapUserPostListItemToPost(item);
      return (
        <View style={{ marginHorizontal: gap / 2, marginBottom: verticalGap }}>
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
        </View>
      );
    },
    [gap, handlePostPress, handleEditPost, handleDeletePost, theme, verticalGap]
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
        <FlashList
          contentContainerStyle={{ paddingHorizontal: horizontalPadding, paddingTop: 12, paddingBottom: bottomContentPadding }}
          data={content}
          masonry
          optimizeItemArrangement={false}
          numColumns={numColumns}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderPostCard}
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
        />
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
