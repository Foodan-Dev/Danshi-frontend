import React, { useEffect, useState, useMemo } from 'react';
import { StyleSheet, View, StyleProp, ViewStyle, Image, Pressable, Alert, Platform } from 'react-native';
import { Text, useTheme as usePaperTheme, IconButton, Menu } from 'react-native-paper';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { Post } from '@/src/models/Post';
import { UserAvatar } from '@/src/components/user_avatar';
import { SHARE_LABEL } from '@/src/constants/post_labels';
import { getSafeRemoteUrl } from '@/src/lib/security/url';

// 莫兰迪色系背景色组（低饱和、高明度）
const POSTER_COLORS = [
  { bg: '#FFF2E8', text: '#8B5A2B' },  // 温暖米黄
  { bg: '#E8F3FF', text: '#2E5A8B' },  // 清爽淡蓝
  { bg: '#F7E8FF', text: '#6B4D8A' },  // 淡雅香芋紫
  { bg: '#E8FFEA', text: '#3D7A4A' },  // 清新薄荷绿
  { bg: '#FFFBE8', text: '#8B7A2B' },  // 淡柠檬黄
  { bg: '#F2F4F7', text: '#5A5F6B' },  // 高级灰
];


type PostCardProps = {
  post: Post;
  onPress?: (postId: string) => void;
  style?: StyleProp<ViewStyle>;
  footer?: React.ReactNode;
  appearance?: 'flat' | 'elevated' | 'outlined';
  showActions?: boolean;
  onEdit?: (postId: string) => void;
  onDelete?: (postId: string) => void;
};

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onPress,
  style,
  footer,
  appearance = 'flat',
  showActions = false,
  onEdit,
  onDelete,
}) => {
  const theme = usePaperTheme();
  const [menuVisible, setMenuVisible] = useState(false);
  const firstImage = useMemo(
    () => post.images?.map((item) => getSafeRemoteUrl(item)).find((item): item is string => !!item),
    [post.images]
  );
  const displayTitle = useMemo(
    () => post.title?.trim() || post.content?.trim().slice(0, 60) || '分享美食',
    [post.content, post.title]
  );
  const canShowActionsMenu = showActions && (!!onEdit || !!onDelete);
  const appearanceStyle = useMemo(() => {
    switch (appearance) {
      case 'outlined':
        return { borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.outlineVariant };
      case 'elevated':
        return {
          shadowColor: '#000',
          shadowOpacity: 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        };
      case 'flat':
      default:
        return null;
    }
  }, [appearance, theme.colors.outlineVariant]);

  useEffect(() => {
    setMenuVisible(false);
  }, [post.id]);

  // 使用伪随机比例保持瀑布流参差不齐效果
  const seed = useMemo(() => {
    return post.id
      ? Array.from(post.id).reduce((acc, char) => acc + char.charCodeAt(0), 0)
      : 0;
  }, [post.id]);

  const fixedAspectRatio = useMemo(() => {
    const ratioVariants = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.35, 1.5];
    return ratioVariants[seed % ratioVariants.length];
  }, [seed]);

  // 文字海报随机颜色
  const posterColor = useMemo(() => {
    return POSTER_COLORS[seed % POSTER_COLORS.length];
  }, [seed]);

  // 价格显示逻辑
  const priceLabel = useMemo(() => {
    if (post.post_type === 'share' && post.share_type === 'recommend' && typeof post.price === 'number') {
      return `¥${post.price.toFixed(0)}`;
    }
    return null;
  }, [post]);

  // 构建悬浮标签
  const overlayTags = useMemo(() => {
    const tags: { key: string; label: string; variant: 'location' | 'recommend' | 'warning' | 'default' }[] = [];

    // 位置标签
    if (post.canteen) {
      tags.push({ key: 'location', label: post.canteen, variant: 'location' });
    }

    // 类型标签
    if (post.post_type === 'share' && post.share_type) {
      tags.push({
        key: 'shareType',
        label: SHARE_LABEL[post.share_type],
        variant: post.share_type,
      });
    }

    return tags;
  }, [post]);

  const handlePress = () => {
    if (onPress) onPress(post.id);
  };

  // 获取标签样式
  const getTagStyle = (variant: 'location' | 'recommend' | 'warning' | 'default') => {
    switch (variant) {
      case 'recommend':
        return styles.tagRecommend;
      case 'warning':
        return styles.tagWarning;
      case 'location':
      default:
        return styles.tagDefault;
    }
  };

  // 获取标签文字颜色（动态主题）
  const getTagTextColor = (variant: 'location' | 'recommend' | 'warning' | 'default') => {
    // 标签背景是半透明深色，文字统一用高对比度白色
    // 使用 onPrimary 确保在深浅主题下都有足够对比度
    return theme.colors.onPrimary;
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: theme.colors.surface },
        appearanceStyle,
        onPress && pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] },
        style,
      ]}
      accessibilityLabel={`查看帖子 ${displayTitle}`}
      accessibilityRole={onPress ? 'button' : undefined}
    >
      {/* 封面图片区域 */}
      <View style={styles.imageWrapper}>
        {firstImage ? (
          <Image
            source={{ uri: firstImage }}
            style={[
              styles.coverImage,
              { aspectRatio: fixedAspectRatio },
            ]}
            resizeMode="cover"
          />
        ) : (
          // 文字海报 - 莫兰迪色全填充 + 装饰引号水印
          <View style={[styles.textPoster, { backgroundColor: posterColor.bg }]}>
            {/* 左上角装饰引号水印 */}
            <Text style={[styles.quoteWatermark, { color: posterColor.text }]}>{'"'}</Text>
            {/* 主体文字 */}
            <Text 
              style={[styles.posterText, { color: posterColor.text }]} 
              numberOfLines={4}
            >
              {displayTitle}
            </Text>
          </View>
        )}

        {/* 悬浮标签 - 左下角 */}
        {overlayTags.length > 0 && (
          <View style={styles.overlayTagsWrap}>
            {overlayTags.map((tag) => (
              <View key={tag.key} style={[styles.overlayTag, getTagStyle(tag.variant)]}>
                {tag.variant === 'location' && (
                  <Ionicons name="location" size={10} color={getTagTextColor(tag.variant)} style={styles.tagIcon} />
                )}
                <Text style={[styles.overlayTagText, { color: getTagTextColor(tag.variant) }]} numberOfLines={1}>
                  {tag.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* 信息区域 */}
      <View style={styles.infoArea}>
        {/* 标题 - 最多2行 */}
        <View style={styles.titleRow}>
          <Text numberOfLines={2} style={[styles.title, { color: theme.colors.onSurface }]}>
            {displayTitle}
          </Text>
          {canShowActionsMenu && (
            <Menu
              visible={menuVisible}
              onDismiss={() => setMenuVisible(false)}
              anchor={
                <IconButton
                  icon="dots-vertical"
                  size={16}
                  onPress={(event) => {
                    event.stopPropagation();
                    setMenuVisible(true);
                  }}
                  style={styles.actionBtn}
                />
              }
            >
              {onEdit ? (
                <Menu.Item
                  onPress={() => {
                    setMenuVisible(false);
                    onEdit(post.id);
                  }}
                  title="编辑"
                  leadingIcon="pencil"
                />
              ) : null}
              {onDelete ? (
                <Menu.Item
                  onPress={() => {
                    setMenuVisible(false);
                    const doDelete = () => onDelete(post.id);
                    if (Platform.OS === 'web') {
                      if (window.confirm('删除后无法恢复，确定要删除这篇帖子吗？')) {
                        doDelete();
                      }
                    } else {
                      Alert.alert('确认删除', '删除后无法恢复，确定要删除这篇帖子吗？', [
                        { text: '取消', style: 'cancel' },
                        { text: '删除', style: 'destructive', onPress: doDelete },
                      ]);
                    }
                  }}
                  title="删除"
                  leadingIcon="delete"
                  titleStyle={{ color: theme.colors.error }}
                />
              ) : null}
            </Menu>
          )}
        </View>

        {/* 话题标签 + 价格 */}
        <View style={styles.tagsRow}>
          <View style={[styles.topicTags, priceLabel ? { maxWidth: '70%' } : null]}>
            {post.tags && post.tags.length > 0 && post.tags.slice(0, 2).map((tag, idx) => (
              <Text key={idx} style={[styles.topicTag, { color: theme.colors.onSurfaceVariant }]} numberOfLines={1}>
                #{tag}
              </Text>
            ))}
          </View>
          {priceLabel && <Text style={[styles.priceTag, { color: theme.colors.error }]}>{priceLabel}</Text>}
        </View>

        {/* 底部栏：头像+昵称 | 爱心+点赞数 */}
        <View style={styles.footerRow}>
          <View style={styles.authorWrap}>
            {post.author ? (
              <>
                <UserAvatar
                  userId={post.author.id}
                  name={post.author.name}
                  avatar_url={post.author.avatar_url}
                  size={18}
                  disabled
                />
                <Text numberOfLines={1} style={[styles.authorName, { color: theme.colors.onSurfaceVariant }]}>
                  {post.author.name}
                </Text>
              </>
            ) : (
              <Text style={[styles.authorName, { color: theme.colors.onSurfaceVariant }]}>匿名用户</Text>
            )}
          </View>

          <View style={styles.likeWrap}>
            <Ionicons
              name={post.is_liked ? 'heart' : 'heart-outline'}
              size={14}
              color={post.is_liked ? theme.colors.error : theme.colors.onSurfaceVariant}
            />
            <Text style={[styles.likeCount, { color: post.is_liked ? theme.colors.error : theme.colors.onSurfaceVariant }]}>
              {post.stats?.like_count ?? 0}
            </Text>
          </View>
        </View>

        {footer ? <View style={styles.customFooter}>{footer}</View> : null}
      </View>
    </Pressable>
  );
};

/**
 * 估算卡片高度（用于瀑布流布局）
 * 使用伪随机比例产生参差不齐的效果
 */
export function estimatePostCardHeight(post: Post, minHeight: number, maxHeight: number): number {
  // 信息区高度（标题2行 + 标签 + 底部栏）
  const infoHeight = 88;

  // 卡片宽度估算（双列布局，屏幕宽度约360-400，减去间距）
  const cardWidth = 165;
  let imageHeight = 120; // 默认占位图高度

  if (post.images?.length) {
    // 根据帖子 ID 生成伪随机比例，产生参差不齐的瀑布流效果
    const seed = post.id
      ? Array.from(post.id).reduce((acc, char) => acc + char.charCodeAt(0), 0)
      : 0;
    // 更大的变化范围，让瀑布流更有层次感
    const ratioVariants = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.35, 1.5];
    const ratio = ratioVariants[seed % ratioVariants.length];
    imageHeight = cardWidth / ratio;
  }

  const totalHeight = imageHeight + infoHeight;
  return Math.max(minHeight, Math.min(maxHeight, totalHeight));
}

/**
 * 根据帖子 ID 生成固定的伪随机宽高比
 * 用于保持瀑布流参差不齐的效果
 */
export function getPostImageAspectRatio(postId: string): number {
  const seed = postId
    ? Array.from(postId).reduce((acc, char) => acc + char.charCodeAt(0), 0)
    : 0;
  const ratioVariants = [0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.35, 1.5];
  return ratioVariants[seed % ratioVariants.length];
}

const styles = StyleSheet.create({
  // 卡片容器 - 无阴影扁平风格
  card: {
    borderRadius: 8,
    overflow: 'hidden',
  },

  // ==================== 封面图区域 ====================
  imageWrapper: {
    position: 'relative',
    width: '100%',
    minHeight: 100,
  },
  coverImage: {
    width: '100%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },

  // ==================== 文字海报（莫兰迪色全填充）====================
  textPoster: {
    width: '100%',
    aspectRatio: 1,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'center',  // 垂直居中
    alignItems: 'flex-start',  // 水平左对齐
    position: 'relative',
    overflow: 'hidden',
  },
  quoteWatermark: {
    position: 'absolute',
    top: -8,
    left: 8,
    fontSize: 72,
    fontWeight: '700',
    opacity: 0.2,
    lineHeight: 72,
  },
  posterText: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 31,  // 22 * 1.4 ≈ 31
  },

  // ==================== 悬浮标签 ====================
  overlayTagsWrap: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    flexDirection: 'row',
    gap: 4,
    maxWidth: '85%',
  },
  overlayTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  overlayTagText: {
    fontSize: 10,
    fontWeight: '600',
  },
  tagIcon: {
    marginRight: 2,
  },

  // 标签变体
  tagDefault: {
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  tagRecommend: {
    backgroundColor: 'rgba(16,185,129,0.85)',
  },
  tagWarning: {
    backgroundColor: 'rgba(239,68,68,0.85)',
  },
  // 标签文字颜色已改为动态主题获取

  // ==================== 信息区域 ====================
  infoArea: {
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 6,
  },

  // 标题
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  actionBtn: {
    margin: 0,
    marginTop: -4,
    marginRight: -6,
  },

  // 话题标签 + 价格
  tagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 16,
  },
  topicTags: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
    flexShrink: 1,
    overflow: 'hidden',
  },
  topicTag: {
    fontSize: 11,
    fontWeight: '500',
    flexShrink: 1,
  },
  priceTag: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 0,
    marginLeft: 8,
  },

  // ==================== 底部栏 ====================
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  authorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    fontSize: 11,
    flex: 1,
  },
  likeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  likeCount: {
    fontSize: 11,
    fontVariant: ['tabular-nums'],
  },
  likeCountActive: {
    // color is set dynamically
  },

  customFooter: {
    marginTop: 4,
  },
});
