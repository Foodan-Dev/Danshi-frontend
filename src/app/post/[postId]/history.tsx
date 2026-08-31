import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
  Chip,
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

const confirmSwitchRevision = (revision: number): Promise<boolean> => {
  const title = `切换到版本 ${revision}`;
  const message = '帖子将展示这个历史版本的内容，确定切换吗？';
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: '取消', style: 'cancel', onPress: () => resolve(false) },
        { text: '切换', onPress: () => resolve(true) },
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

// 后端在历史列表里直接给出 is_current，标明指针当前指向哪一版。
// 不要靠比对快照内容来反推：同一份内容可能存在于多个 revision
// （旧模型遗留的回退会产生重复），比对会命中多条而无法判定。
const findCurrentRevision = (histories: PostHistoryView[]): number | null =>
  histories.find((item) => item.is_current)?.revision ?? null;

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
  const [switchingRevision, setSwitchingRevision] = useState<number | null>(null);

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
      // is_current 由历史接口直接给出，不需要再拉一次帖子详情来推断。
      setHistories(await postsRepository.history(postId));
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

  const currentRevision = useMemo(
    () => findCurrentRevision(histories),
    [histories],
  );

  const currentHistory = useMemo(
    () => (currentRevision != null
      ? histories.find((item) => item.revision === currentRevision) ?? null
      : null),
    [histories, currentRevision],
  );

  const handleSwitchRevision = useCallback(async (revision: number) => {
    if (!validPostId || revision === currentRevision) return;
    const confirmed = await confirmSwitchRevision(revision);
    if (!confirmed) return;
    setSwitchingRevision(revision);
    try {
      const result = await postsRepository.restoreHistory(postId, revision, {});
      reportPostChange({ kind: 'update', postId, status: result.status });
      await loadHistories(true);
      showAlert('切换成功', `已切换到版本 ${revision}`);
    } catch (switchError) {
      showAlert('切换失败', switchError instanceof Error ? switchError.message : '请稍后重试');
    } finally {
      setSwitchingRevision(null);
    }
  }, [currentRevision, loadHistories, postId, reportPostChange, validPostId]);

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
          {histories.length ? (
            currentRevision != null ? (
              <View
                style={[
                  styles.currentBanner,
                  {
                    backgroundColor: `${theme.colors.primary}12`,
                    borderColor: theme.colors.primary,
                  },
                ]}
              >
                <List.Icon icon="check-decagram" color={theme.colors.primary} />
                <View style={styles.currentBannerText}>
                  <Text style={[styles.currentBannerLabel, { color: theme.colors.primary }]}>
                    当前生效版本
                  </Text>
                  <Text style={[styles.currentBannerValue, { color: theme.colors.onSurface }]}>
                    版本 {currentRevision}
                  </Text>
                  {currentHistory ? (
                    <Text style={[styles.currentBannerMeta, { color: theme.colors.onSurfaceVariant }]}>
                      {formatHistoryTime(currentHistory.edited_at)}
                      {currentHistory.edit_reason ? ` · ${currentHistory.edit_reason}` : ''}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : (
              <View
                style={[
                  styles.currentBanner,
                  {
                    backgroundColor: theme.colors.surfaceVariant,
                    borderColor: theme.colors.outlineVariant,
                  },
                ]}
              >
                <List.Icon icon="help-circle-outline" color={theme.colors.onSurfaceVariant} />
                <Text style={[styles.currentBannerMeta, { color: theme.colors.onSurfaceVariant, flex: 1 }]}>
                  暂时无法确认当前生效的版本
                </Text>
              </View>
            )
          ) : null}

          {histories.length ? histories.map((history) => {
            const isCurrent = history.revision === currentRevision;
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
                    backgroundColor: isCurrent ? `${theme.colors.primary}0F` : theme.colors.surface,
                    borderColor: isCurrent ? theme.colors.primary : theme.colors.outlineVariant,
                    borderWidth: isCurrent ? 1.5 : StyleSheet.hairlineWidth,
                  },
                ]}
              >
                <List.Accordion
                  title={(
                    <View style={styles.titleRow}>
                      <Text style={[styles.versionTitleText, { color: theme.colors.onSurface }]}>
                        版本 {history.revision}
                      </Text>
                      {isCurrent ? (
                        <Chip
                          compact
                          mode="flat"
                          style={[styles.currentChip, { backgroundColor: theme.colors.primary }]}
                          textStyle={[styles.currentChipText, { color: theme.colors.onPrimary }]}
                        >
                          当前版本
                        </Chip>
                      ) : null}
                    </View>
                  )}
                  description={description}
                  descriptionNumberOfLines={2}
                  expanded={expanded}
                  onPress={() => setExpandedRevision(expanded ? null : history.revision)}
                  left={(props) => <List.Icon {...props} icon="history" />}
                  style={{ backgroundColor: 'transparent' }}
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
                    {isCurrent ? (
                      <View style={styles.currentNotice}>
                        <List.Icon icon="check-circle" color={theme.colors.primary} />
                        <Text style={[styles.currentNoticeText, { color: theme.colors.onSurfaceVariant }]}>
                          这是当前生效的版本，无需切换
                        </Text>
                      </View>
                    ) : (
                      <Button
                        mode="contained-tonal"
                        icon="swap-horizontal"
                        loading={switchingRevision === history.revision}
                        disabled={switchingRevision !== null}
                        onPress={() => void handleSwitchRevision(history.revision)}
                        style={styles.switchButton}
                      >
                        切换到此版本
                      </Button>
                    )}
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
  currentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  currentBannerText: {
    flex: 1,
    gap: 2,
  },
  currentBannerLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  currentBannerValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  currentBannerMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  historyItem: {
    overflow: 'hidden',
    borderRadius: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  versionTitleText: {
    fontSize: 16,
    fontWeight: '600',
  },
  currentChip: {
    justifyContent: 'center',
  },
  currentChipText: {
    fontSize: 11,
    fontWeight: '700',
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
  switchButton: {
    alignSelf: 'flex-start',
    marginTop: 18,
  },
  currentNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 4,
  },
  currentNoticeText: {
    fontSize: 13,
    flexShrink: 1,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 72,
    gap: 8,
  },
});
