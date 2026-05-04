import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, ScrollView, Pressable, TextInput as RNTextInput, Image, TextStyle, type StyleProp, useWindowDimensions } from 'react-native';
import {
  ActivityIndicator,
  Text,
  useTheme as usePaperTheme,
  Chip,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { searchService, type SearchPost, type SearchUser } from '@/src/services/search_service';
import { usersService } from '@/src/services/users_service';
import { useAuth } from '@/src/context/auth_context';
import { showAlert } from '@/src/utils/alert';
import { useBreakpoint } from '@/src/hooks/use_responsive';
import { pickByBreakpoint } from '@/src/constants/breakpoints';
import { Masonry } from '@/src/components/md3/masonry';
import { PostCard, estimatePostCardHeight } from '@/src/components/post_card';
import { useWaterfallSettings } from '@/src/context/waterfall_context';
import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WEB_NO_OUTLINE } from '@/src/utils';
import { getSafeRemoteUrl } from '@/src/lib/security/url';

// 宽屏断点
const WIDE_BREAKPOINT = 768;
const SEARCH_HISTORY_KEY = '@search_history';
const MAX_HISTORY_ITEMS = 10;

type TabValue = 'posts' | 'users';

// ==================== 高亮文本组件（仅加粗，不变色）====================
const HIGHLIGHT_OPEN = '<em>';
const HIGHLIGHT_CLOSE = '</em>';

type HighlightedTextProps = {
  value: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
};

const HighlightedText: React.FC<HighlightedTextProps> = ({ value, style, numberOfLines = 2 }) => {
  const segments = useMemo(() => {
    const rawParts = value.split(/(<em>|<\/em>)/i);
    const nodes: { text: string; bold: boolean }[] = [];
    let active = false;
    for (const part of rawParts) {
      if (!part) continue;
      if (part.toLowerCase() === HIGHLIGHT_OPEN) {
        active = true;
        continue;
      }
      if (part.toLowerCase() === HIGHLIGHT_CLOSE) {
        active = false;
        continue;
      }
      nodes.push({ text: part, bold: active });
    }
    return nodes;
  }, [value]);

  return (
    <Text style={style} numberOfLines={numberOfLines} ellipsizeMode="tail">
      {segments.map((segment, index) => (
        <Text key={`seg-${index}`} style={segment.bold ? { fontWeight: '700' } : undefined}>
          {segment.text}
        </Text>
      ))}
    </Text>
  );
};

// ==================== 智能摘要：截取包含关键词的片段 ====================
function extractMatchSnippet(highlightedContent: string | undefined, maxLength: number = 80): string | null {
  if (!highlightedContent) return null;
  
  // 查找 <em> 标签的位置
  const emStart = highlightedContent.toLowerCase().indexOf('<em>');
  if (emStart === -1) return null;
  
  // 计算截取的起始位置（关键词前后各留一些上下文）
  const contextBefore = 20;
  const start = Math.max(0, emStart - contextBefore);
  
  // 截取片段
  let snippet = highlightedContent.slice(start, start + maxLength);
  
  // 如果不是从开头截取，添加省略号
  if (start > 0) {
    snippet = '...' + snippet;
  }
  
  // 如果不是到结尾，添加省略号
  if (start + maxLength < highlightedContent.length) {
    snippet = snippet + '...';
  }
  
  return snippet;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const theme = usePaperTheme();
  const bp = useBreakpoint();
  const { minHeight, maxHeight } = useWaterfallSettings();
  const { width: windowWidth } = useWindowDimensions();
  
  // 判断是否宽屏
  const isWideScreen = windowWidth >= WIDE_BREAKPOINT;

  const horizontalPadding = pickByBreakpoint(bp, { base: 16, sm: 18, md: 20, lg: 24, xl: 24 });
  const spacing = pickByBreakpoint(bp, { base: 14, sm: 16, md: 18, lg: 20, xl: 24 });
  const gridGap = pickByBreakpoint(bp, { base: 6, sm: 8, md: 10, lg: 14, xl: 18 });
  const gridVerticalGap = gridGap + 8;

  const { user: currentUser } = useAuth();

  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState<TabValue>('posts');
  const [posts, setPosts] = useState<SearchPost[]>([]);
  const [users, setUsers] = useState<SearchUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [followLoadingMap, setFollowLoadingMap] = useState<Record<string, boolean>>({});
  const requestSeqRef = useRef(0);

  // 加载搜索历史
  useEffect(() => {
    AsyncStorage.getItem(SEARCH_HISTORY_KEY)
      .then((data) => {
        if (data) {
          setSearchHistory(JSON.parse(data));
        }
      })
      .catch(() => {});
  }, []);

  // 保存搜索历史
  const saveToHistory = useCallback(async (term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    const newHistory = [trimmed, ...searchHistory.filter((h) => h !== trimmed)].slice(0, MAX_HISTORY_ITEMS);
    setSearchHistory(newHistory);
    await AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
  }, [searchHistory]);

  // 清除搜索历史
  const clearHistory = useCallback(async () => {
    setSearchHistory([]);
    await AsyncStorage.removeItem(SEARCH_HISTORY_KEY);
  }, []);

  const handlePostPress = useCallback(
    (postId: string) => {
      const href: Href = { pathname: '/post/[postId]', params: { postId } } as const;
      router.push(href);
    },
    [router]
  );

  const handleUserPress = useCallback(
    (userId: string) => {
      router.push({ pathname: '/user/[userId]', params: { userId } });
    },
    [router]
  );

  const doSearch = useCallback(async (tab: TabValue, term: string) => {
    if (!term) {
      setError('请输入搜索关键词');
      setHasSearched(false);
      return;
    }
    const requestId = ++requestSeqRef.current;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'posts') {
        const { posts: result } = await searchService.searchPosts({ q: term, limit: 20 });
        if (requestSeqRef.current !== requestId) return;
        setPosts(result);
        setUsers([]);
      } else {
        const { users: result } = await searchService.searchUsers({ q: term, limit: 20 });
        if (requestSeqRef.current !== requestId) return;
        setUsers(result);
        setPosts([]);
      }
      setHasSearched(true);
    } catch (e) {
      if (requestSeqRef.current !== requestId) return;
      const message = (e as Error)?.message ?? '搜索失败，请稍后重试';
      setError(message);
    } finally {
      if (requestSeqRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  const handleSearch = useCallback(() => {
    const term = keyword.trim();
    if (term) {
      saveToHistory(term);
    }
    doSearch(activeTab, term);
  }, [activeTab, keyword, doSearch, saveToHistory]);

  const handleHistoryPress = useCallback((term: string) => {
    setKeyword(term);
    saveToHistory(term);
    doSearch(activeTab, term);
  }, [activeTab, doSearch, saveToHistory]);

  const handleTabChange = useCallback(
    (value: TabValue) => {
      setActiveTab(value);
      const term = keyword.trim();
      if (hasSearched && term) {
        // 切换标签后使用新的 tab 值重新搜索
        doSearch(value, term);
      }
    },
    [doSearch, hasSearched, keyword]
  );

  const handleToggleFollow = useCallback(async (userId: string, currentlyFollowing: boolean) => {
    if (!currentUser) {
      showAlert('请先登录', '登录后才能关注用户');
      return;
    }
    setFollowLoadingMap(prev => ({ ...prev, [userId]: true }));
    try {
      if (currentlyFollowing) {
        await usersService.unfollowUser(userId);
      } else {
        await usersService.followUser(userId);
      }
      // 乐观更新本地用户列表中的关注状态
      setUsers(prev => prev.map(u =>
        u.id === userId
          ? {
              ...u,
              is_following: !currentlyFollowing,
              stats: {
                ...u.stats,
                follower_count: Math.max(0, (u.stats?.follower_count ?? 0) + (currentlyFollowing ? -1 : 1)),
              },
            }
          : u
      ));
    } catch (err: any) {
      showAlert('操作失败', err.message || '请稍后重试');
    } finally {
      setFollowLoadingMap(prev => ({ ...prev, [userId]: false }));
    }
  }, [currentUser]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* 宽屏时使用居中容器 */}
      <View style={[
        styles.contentWrapper,
        isWideScreen && styles.wideContentWrapper,
      ]}>
        {/* ==================== 顶部导航栏 ==================== */}
        <View
          style={[
            styles.topBar,
            {
              paddingTop: isWideScreen ? 24 : insets.top,
              backgroundColor: theme.colors.background,
            },
          ]}
        >
          {/* 第一行：搜索框 */}
          <View style={[styles.topBarContent, isWideScreen && styles.wideTopBarContent]}>
            {/* 左侧：返回按钮 - 仅在窄屏显示 */}
            {!isWideScreen && (
              <Pressable style={styles.backBtn} onPress={() => router.back()}>
                <Ionicons name="arrow-back" size={24} color={theme.colors.onSurface} />
              </Pressable>
            )}

            {/* 中间：搜索框 */}
            <View
              style={[
                styles.searchInputWrapper,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderRadius: isWideScreen ? 26 : 22,
                },
                isWideScreen && styles.wideSearchInputWrapper,
              ]}
            >
              <Ionicons name="search" size={isWideScreen ? 20 : 18} color={theme.colors.onSurfaceVariant} />
              <RNTextInput
                value={keyword}
                onChangeText={setKeyword}
                onSubmitEditing={handleSearch}
                placeholder="搜索美食或用户"
                placeholderTextColor={theme.colors.outline}
                returnKeyType="search"
                autoCapitalize="none"
                selectionColor={theme.colors.primary}
                style={[
                  styles.searchInput,
                  {
                    color: theme.colors.onSurface,
                    fontSize: isWideScreen ? 16 : 15,
                  },
                  WEB_NO_OUTLINE,
                ]}
              />
              {keyword.trim() ? (
                <Pressable onPress={() => setKeyword('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={isWideScreen ? 20 : 18} color={theme.colors.onSurfaceVariant} />
                </Pressable>
              ) : null}
            </View>

            {/* 右侧：按钮 - 窄屏显示文字，宽屏显示图标或隐藏 */}
            {!isWideScreen && (
              <Pressable
                style={styles.textBtn}
                onPress={keyword.trim() ? handleSearch : () => router.back()}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size={16} color={theme.colors.primary} />
                ) : (
                  <Text style={[styles.textBtnLabel, { color: keyword.trim() ? theme.colors.primary : theme.colors.onSurfaceVariant }]}>
                    {keyword.trim() ? '搜索' : '取消'}
                  </Text>
                )}
              </Pressable>
            )}
            {isWideScreen && keyword.trim() && (
              <Pressable
                style={[styles.wideSearchBtn, { backgroundColor: theme.colors.primary }]}
                onPress={handleSearch}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size={18} color={theme.colors.onPrimary} />
                ) : (
                  <Ionicons name="search" size={20} color={theme.colors.onPrimary} />
                )}
              </Pressable>
            )}
          </View>

          {/* 第二行：帖子/用户选择器 */}
          <View style={[
            styles.tabRow, 
            { borderBottomWidth: 1, borderBottomColor: theme.colors.outlineVariant },
            isWideScreen && styles.wideTabRow,
          ]}>
            <Pressable
              style={[styles.tabItem, isWideScreen && styles.wideTabItem]}
              onPress={() => handleTabChange('posts')}
            >
              <Text
                style={[
                  styles.tabText,
                  isWideScreen && styles.wideTabText,
                  {
                    color: activeTab === 'posts' ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
                    fontWeight: activeTab === 'posts' ? '600' : '400',
                  },
                ]}
              >
                帖子
              </Text>
              {activeTab === 'posts' && (
                <View style={[
                  styles.tabIndicator, 
                  { backgroundColor: theme.colors.primary },
                  isWideScreen && styles.wideTabIndicator,
                ]} />
              )}
            </Pressable>
            <Pressable
              style={[styles.tabItem, isWideScreen && styles.wideTabItem]}
              onPress={() => handleTabChange('users')}
            >
              <Text
                style={[
                  styles.tabText,
                  isWideScreen && styles.wideTabText,
                  {
                    color: activeTab === 'users' ? theme.colors.onSurface : theme.colors.onSurfaceVariant,
                    fontWeight: activeTab === 'users' ? '600' : '400',
                  },
                ]}
              >
                用户
              </Text>
              {activeTab === 'users' && (
                <View style={[
                  styles.tabIndicator, 
                  { backgroundColor: theme.colors.primary },
                  isWideScreen && styles.wideTabIndicator,
                ]} />
              )}
            </Pressable>
          </View>
        </View>

        {/* ==================== 内容区域 ==================== */}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ 
            paddingHorizontal: isWideScreen ? 0 : horizontalPadding, 
            paddingBottom: insets.bottom + spacing * 2,
            paddingTop: spacing,
          }}
        >
          {/* 错误提示 */}
          {error ? (
            <View style={[styles.errorCard, { backgroundColor: theme.colors.errorContainer }]}>
              <Ionicons name="alert-circle" size={16} color={theme.colors.error} />
              <Text style={{ color: theme.colors.error, flex: 1, fontSize: 13 }}>{error}</Text>
            </View>
          ) : null}

        {/* 搜索结果 */}
        {!loading && hasSearched && !error ? (
          activeTab === 'posts' ? (
            posts.length ? (
              <Masonry
                data={posts}
                columns={{ base: 2, md: 2, lg: 3, xl: 4 }}
                gap={gridGap}
                verticalGap={gridVerticalGap}
                keyExtractor={(item) => item.id}
                getItemHeight={(item) => estimatePostCardHeight(item, minHeight, maxHeight)}
                renderItem={(item) => {
                  // 智能摘要：如果关键词在正文中匹配，显示摘要
                  const snippet = extractMatchSnippet(item.highlight?.content);
                  const showSnippet = snippet && !item.highlight?.title; // 只有标题没匹配时才显示正文摘要
                  
                  return (
                    <View>
                      <PostCard
                        post={item}
                        onPress={handlePostPress}
                        appearance="flat"
                      />
                      {showSnippet && (
                        <View style={[styles.snippetContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
                          <HighlightedText
                            value={snippet}
                            style={[styles.snippetText, { color: theme.colors.onSurfaceVariant }]}
                            numberOfLines={2}
                          />
                        </View>
                      )}
                    </View>
                  );
                }}
              />
            ) : (
              <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>未找到相关帖子</Text>
            )
          ) : users.length ? (
            <View style={styles.userList}>
              {users.map((user) => {
                const safeAvatarUrl = getSafeRemoteUrl(user.avatar_url);
                return (
                  <Pressable
                    key={user.id}
                    style={styles.userItem}
                    onPress={() => handleUserPress(user.id)}
                  >
                    {/* 左侧：头像 */}
                    <View style={styles.userAvatar}>
                      {safeAvatarUrl ? (
                        <Image source={{ uri: safeAvatarUrl }} style={styles.avatarImage} />
                      ) : (
                        <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
                          <Ionicons name="person" size={20} color={theme.colors.onSurfaceVariant} />
                        </View>
                      )}
                    </View>

                    {/* 中间：用户信息 */}
                    <View style={styles.userInfo}>
                      <Text style={[styles.userName, { color: theme.colors.onSurface }]} numberOfLines={1}>
                        {user.name}
                      </Text>
                      <Text style={[styles.userMeta, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                        帖子 {user.stats?.post_count ?? 0} · 粉丝 {user.stats?.follower_count ?? 0}
                      </Text>
                    </View>

                    {/* 右侧：关注按钮（不对自己显示） */}
                    {currentUser && currentUser.id !== user.id && (
                      <Pressable
                        style={[
                          styles.followBtn,
                          user.is_following
                            ? { backgroundColor: theme.colors.surfaceVariant }
                            : { borderWidth: 1, borderColor: theme.colors.primary },
                          followLoadingMap[user.id] && { opacity: 0.6 },
                        ]}
                        disabled={followLoadingMap[user.id]}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleToggleFollow(user.id, !!user.is_following);
                        }}
                      >
                        {followLoadingMap[user.id] ? (
                          <ActivityIndicator size={14} color={theme.colors.primary} />
                        ) : (
                          <Text
                            style={[
                              styles.followBtnText,
                              { color: user.is_following ? theme.colors.onSurfaceVariant : theme.colors.primary }
                            ]}
                          >
                            {user.is_following ? '已关注' : '关注'}
                          </Text>
                        )}
                      </Pressable>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: theme.colors.onSurfaceVariant }]}>未找到相关用户</Text>
          )
        ) : null}

        {/* 未搜索时的提示 - 增加历史搜索 */}
        {!hasSearched && !loading && !error ? (
          <View style={[styles.hintContainer, isWideScreen && styles.wideHintContainer]}>
            {/* 历史搜索 */}
            {searchHistory.length > 0 && (
              <View style={styles.historySection}>
                <View style={styles.historySectionHeader}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                    最近搜索
                  </Text>
                  <Pressable onPress={clearHistory} hitSlop={8}>
                    <Text style={[styles.clearText, { color: theme.colors.onSurfaceVariant }]}>
                      清除
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.historyChips}>
                  {searchHistory.map((term, index) => (
                    <Chip
                      key={`history-${index}`}
                      mode="outlined"
                      style={[styles.historyChip, { borderColor: theme.colors.outlineVariant }]}
                      textStyle={{ color: theme.colors.onSurface, fontSize: 13 }}
                      onPress={() => handleHistoryPress(term)}
                      onClose={() => {
                        const newHistory = searchHistory.filter((_, i) => i !== index);
                        setSearchHistory(newHistory);
                        AsyncStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(newHistory));
                      }}
                      closeIcon="close"
                    >
                      {term}
                    </Chip>
                  ))}
                </View>
              </View>
            )}

            {/* 空状态图标 - 仅在没有历史时显示 */}
            {searchHistory.length === 0 && (
              <View style={styles.emptyHint}>
                <Ionicons name="search-outline" size={48} color={theme.colors.outlineVariant} />
                <Text style={[styles.hintText, { color: theme.colors.onSurfaceVariant }]}>
                  输入关键词搜索美食或用户
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // ==================== 宽屏容器 ====================
  contentWrapper: {
    flex: 1,
  },
  wideContentWrapper: {
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
  },

  // ==================== 顶部导航栏 ====================
  topBar: {
    borderBottomWidth: 0,
  },
  topBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  wideTopBarContent: {
    paddingHorizontal: 0,
    paddingVertical: 16,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  wideSearchInputWrapper: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  textBtn: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  textBtnLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  wideSearchBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ==================== Tab 切换 ====================
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
  },
  wideTabRow: {
    paddingHorizontal: 0,
    justifyContent: 'center',
  },
  tabItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    position: 'relative',
    alignItems: 'center',
  },
  wideTabItem: {
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  tabText: {
    fontSize: 15,
  },
  wideTabText: {
    fontSize: 16,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 16,
    right: 16,
    height: 2,
    borderRadius: 1,
  },
  wideTabIndicator: {
    height: 3,
    left: 24,
    right: 24,
    borderRadius: 1.5,
  },

  // ==================== 错误提示 ====================
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },

  // ==================== 空状态/提示 ====================
  hintContainer: {
    paddingTop: 24,
  },
  wideHintContainer: {
    paddingTop: 32,
  },
  emptyHint: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    gap: 12,
  },
  hintText: {
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 24,
  },

  // ==================== 历史搜索 ====================
  historySection: {
    marginBottom: 28,
  },
  historySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  clearText: {
    fontSize: 13,
  },
  historyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  historyChip: {
    backgroundColor: 'transparent',
  },

  // ==================== 用户列表 ====================
  userList: {
    gap: 0,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    gap: 2,
  },
  userName: {
    fontSize: 15,
    fontWeight: '600',
  },
  userMeta: {
    fontSize: 13,
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  followBtnText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // ==================== 搜索摘要 ====================
  snippetContainer: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  snippetText: {
    fontSize: 12,
    lineHeight: 18,
  },
});
