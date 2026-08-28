import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  List,
  Text,
  useTheme as usePaperTheme,
} from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  postsRepository,
  type PostHistoryView,
} from '@/src/repositories/posts_repository';
import { showAlert } from '@/src/utils/alert';
import { usePostChanges } from '@/src/context/post_changes_context';

const confirmRestore = (revision: number): Promise<boolean> => {
  const title = `恢复版本 ${revision}`;
  const message = '当前帖子内容将替换为这个历史版本，确定继续吗？';
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: '取消', style: 'cancel', onPress: () => resolve(false) },
        { text: '恢复', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
};

const formatHistoryTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
};

export default function PostHistoryRoute() {
  const router = useRouter();
  const { reportPostChange } = usePostChanges();
  const insets = useSafeAreaInsets();
  const theme = usePaperTheme();
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const postIdParam = params.postId;
  const rawPostId = Array.isArray(postIdParam) ? postIdParam[0] : postIdParam;
  const postId = rawPostId ? Number(rawPostId) : Number.NaN;
  const validPostId = Number.isSafeInteger(postId) && postId > 0;

  const [histories, setHistories] = useState<PostHistoryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [expandedRevision, setExpandedRevision] = useState<number | null>(null);
  const [restoringRevision, setRestoringRevision] = useState<number | null>(null);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (validPostId) {
      router.replace(`/post/${postId}`);
      return;
    }
    router.replace('/(tabs)/explore');
  }, [postId, router, validPostId]);

  const loadHistories = useCallback(async (isRefresh = false) => {
    if (!validPostId) {
      setError('帖子 ID 缺失，无法读取历史版本');
      setLoading(false);
      return;
    }
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const result = await postsRepository.history(postId);
      setHistories(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '读取历史版本失败，请稍后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [postId, validPostId]);

  useEffect(() => {
    void loadHistories();
  }, [loadHistories]);

  const handleRestore = useCallback(async (revision: number) => {
    const confirmed = await confirmRestore(revision);
    if (!confirmed || !validPostId) return;
    setRestoringRevision(revision);
    try {
      const result = await postsRepository.restoreHistory(postId, revision, {});
      reportPostChange({ kind: 'update', postId, status: result.status });
      await loadHistories(true);
      showAlert('恢复成功', `帖子已恢复到版本 ${revision}`);
    } catch (restoreError) {
      showAlert('恢复失败', restoreError instanceof Error ? restoreError.message : '请稍后重试');
    } finally {
      setRestoringRevision(null);
    }
  }, [loadHistories, postId, reportPostChange, validPostId]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header mode="center-aligned" statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={handleBack} />
        <Appbar.Content title="历史版本" />
      </Appbar.Header>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" />
          <Text style={[styles.stateText, { color: theme.colors.onSurfaceVariant }]}>正在读取历史版本…</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <List.Icon icon="alert-circle-outline" color={theme.colors.error} />
          <Text style={[styles.stateText, { color: theme.colors.error }]}>{error}</Text>
          {validPostId ? (
            <Button mode="contained-tonal" onPress={() => void loadHistories()}>
              重新加载
            </Button>
          ) : null}
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          refreshControl={(
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => void loadHistories(true)}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
              progressBackgroundColor={theme.colors.surface}
            />
          )}
        >
          {histories.length ? histories.map((history) => {
            const expanded = expandedRevision === history.revision;
            const description = history.edit_reason
              ? `${formatHistoryTime(history.edited_at)}\n修改原因：${history.edit_reason}`
              : formatHistoryTime(history.edited_at);
            return (
              <View
                key={history.id}
                style={[
                  styles.historyItem,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <List.Accordion
                  title={`版本 ${history.revision}`}
                  description={description}
                  descriptionNumberOfLines={2}
                  expanded={expanded}
                  onPress={() => setExpandedRevision(expanded ? null : history.revision)}
                  left={(props) => <List.Icon {...props} icon="history" />}
                  style={{ backgroundColor: theme.colors.surface }}
                >
                  <View style={styles.snapshot}>
                    <Text style={[styles.snapshotLabel, { color: theme.colors.onSurfaceVariant }]}>标题</Text>
                    <Text style={[styles.snapshotTitle, { color: theme.colors.onSurface }]}>
                      {history.snapshot.title}
                    </Text>
                    <Text style={[styles.snapshotLabel, { color: theme.colors.onSurfaceVariant }]}>正文摘要</Text>
                    <Text
                      style={[styles.snapshotContent, { color: theme.colors.onSurface }]}
                      numberOfLines={6}
                    >
                      {history.snapshot.content}
                    </Text>
                    <Button
                      mode="contained-tonal"
                      icon="backup-restore"
                      loading={restoringRevision === history.revision}
                      disabled={restoringRevision !== null}
                      onPress={() => void handleRestore(history.revision)}
                      style={styles.restoreButton}
                    >
                      恢复此版本
                    </Button>
                  </View>
                </List.Accordion>
              </View>
            );
          }) : (
            <View style={styles.emptyState}>
              <List.Icon icon="history" color={theme.colors.onSurfaceVariant} />
              <Text style={{ color: theme.colors.onSurfaceVariant }}>暂无历史版本</Text>
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  stateText: {
    textAlign: 'center',
  },
  historyItem: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
  snapshot: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 18,
  },
  snapshotLabel: {
    marginTop: 12,
    marginBottom: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  snapshotTitle: {
    fontSize: 17,
    fontWeight: '600',
    lineHeight: 24,
  },
  snapshotContent: {
    fontSize: 14,
    lineHeight: 22,
  },
  restoreButton: {
    alignSelf: 'flex-start',
    marginTop: 18,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 72,
    gap: 8,
  },
});
