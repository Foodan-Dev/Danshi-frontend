import React from 'react';
import { View, StyleSheet, Pressable, type ViewStyle } from 'react-native';
import { Avatar, Icon, Text, useTheme as usePaperTheme } from 'react-native-paper';
import type { CommentEntity, MentionedUser } from '@/src/models/Comment';
import { UserAvatar } from '@/src/components/user_avatar';
import { formatRelativeTime } from '@/src/utils/time_format';

type BaseProps = {
  onLike?: (comment: CommentEntity) => void;
  onReply?: (comment: CommentEntity) => void;
  getMoreActions?: (comment: CommentEntity) => {
    key: string;
    title: string;
    icon?: string;
    destructive?: boolean;
    onPress: () => void;
  }[];
  onShowReplies?: (comment: CommentEntity) => void;
};

type CommentItemProps = BaseProps & {
  comment: CommentEntity;
  isReply?: boolean;
  depth?: number;
  showMentionHighlight?: boolean;
  maxContentLines?: number;
  replyCount?: number;
  showReplySummary?: boolean;
};

function MentionedText({ mentions }: { mentions?: MentionedUser[] }) {
  if (!mentions?.length) return null;
  return (
    <View style={styles.mentionRow}>
      {mentions.map((mention, idx) => (
        <React.Fragment key={mention.id}>
          <UserAvatar
            userId={mention.id}
            name={`@${mention.name}`}
            size={16}
            show_name
            disabled
          />
          {idx < mentions.length - 1 ? <Text> </Text> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  isReply = false,
  depth = 0,
  showMentionHighlight = false,
  maxContentLines,
  replyCount,
  showReplySummary = true,
  onLike,
  onReply,
  getMoreActions,
  onShowReplies,
}) => {
  const theme = usePaperTheme();
  const isAuthor = comment.is_author;
  const handleLike = () => onLike?.(comment);
  const handleReply = () => onReply?.(comment);
  const handleShowReplies = () => onShowReplies?.(comment);
  const moreActions = getMoreActions?.(comment) ?? [];
  const totalReplyCount = replyCount ?? ('reply_count' in comment ? comment.reply_count : 0);
  const showReplySummaryButton = showReplySummary && totalReplyCount > 0 && !!onShowReplies;
  const canReply = !!onReply;
  const canLike = !!onLike;

  const isNested = isReply || depth > 0;
  const avatarSize = isNested ? 28 : 40;

  const containerStyles: ViewStyle[] = [styles.container];
  if (isNested) {
    containerStyles.push(styles.replyContainer);
    containerStyles.push(depth === 1 ? styles.replyFirstLevel : styles.replySubsequent);
  }

  const bodyStyles: ViewStyle[] = [styles.body];
  if (showMentionHighlight && (comment.mentioned_users?.length ?? 0) > 0) {
    bodyStyles.push({
      backgroundColor: theme.colors.secondaryContainer,
      borderRadius: 12,
      padding: 8,
    });
  }

  const relativeTime = formatRelativeTime(comment.created_at);

  return (
    <View style={containerStyles}>
      <View style={[styles.avatarColumn, isNested && styles.replyAvatarColumn]}>
        {comment.author ? (
          <UserAvatar
            userId={comment.author.id}
            name={comment.author.name}
            avatar_url={comment.author.avatar_url}
            size={avatarSize}
          />
        ) : (
          <Avatar.Text size={avatarSize} label="?" />
        )}
      </View>
      <View style={bodyStyles}>
        <View style={styles.headerRow}>
          <View style={styles.authorBlock}>
            <Text style={[styles.authorName, isNested && styles.replyAuthorName, { color: theme.colors.onSurface }]} numberOfLines={1}>
              {comment.author?.name || '匿名用户'}
            </Text>
            {isAuthor ? (
              <Text style={[styles.authorBadge, { color: theme.colors.primary }]}>
                作者
              </Text>
            ) : null}
          </View>
        </View>

        <Pressable style={styles.bodyPressable} onPress={handleReply} disabled={!canReply}>
          <MentionedText mentions={comment.mentioned_users} />
          <Text
            variant="bodyMedium"
            style={[styles.content, isNested && styles.replyContent, { color: theme.colors.onSurface }]}
            numberOfLines={maxContentLines}
          >
            {comment.reply_to ? (
              <Text style={styles.replyingText}>
                回复{' '}
                <Text style={{ color: theme.colors.onSurfaceVariant }}>
                  {comment.reply_to.name}
                </Text>
                ：
              </Text>
            ) : null}
            {comment.content}
          </Text>
        </Pressable>

        <View style={styles.metaRow}>
          <View style={styles.metaLeft}>
            {relativeTime ? (
              <Text style={[styles.timestamp, { color: theme.colors.onSurfaceVariant }]}>{relativeTime}</Text>
            ) : null}
            <Pressable
              style={({ pressed }) => [
                styles.replyAction,
                pressed && canReply && styles.actionPressed,
                !canReply && styles.actionDisabled,
              ]}
              onPress={handleReply}
              disabled={!canReply}
            >
              <Text style={[styles.replyActionText, { color: theme.colors.onSurfaceVariant }]}>
                回复
              </Text>
            </Pressable>
            {moreActions.map((action) => (
              <Pressable
                key={action.key}
                style={({ pressed }) => [
                  styles.replyAction,
                  pressed && styles.actionPressed,
                ]}
                onPress={action.onPress}
                accessibilityLabel={action.title}
              >
                <Text
                  style={[
                    styles.replyActionText,
                    { color: action.destructive ? theme.colors.error : theme.colors.onSurfaceVariant },
                  ]}
                >
                  {action.title}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.likeButton} onPress={handleLike} disabled={!canLike}>
            <View style={styles.likeIcon}>
              <Icon
                source={comment.is_liked ? 'heart' : 'heart-outline'}
                size={isNested ? 16 : 18}
                color={comment.is_liked ? theme.colors.error : theme.colors.onSurfaceVariant}
              />
            </View>
            <View style={styles.likeCountSlot}>
              {comment.like_count > 0 ? (
                <Text variant="bodySmall" style={styles.actionCount}>
                  {comment.like_count}
                </Text>
              ) : null}
            </View>
          </Pressable>
        </View>

        {showReplySummaryButton ? (
          <Pressable
            onPress={handleShowReplies}
            style={styles.replySummaryButton}
          >
            <Text style={[styles.replySummaryText, { color: theme.colors.primary }]}>
              共{totalReplyCount}条回复 &gt;
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  body: {
    flex: 1,
    gap: 3,
  },
  bodyPressable: {
    gap: 2,
  },
  replyContainer: {
    paddingVertical: 1,
  },
  replyFirstLevel: {
    marginLeft: 54,
  },
  replySubsequent: {
    marginLeft: 54,
  },
  avatarColumn: {
    width: 40,
    alignItems: 'flex-start',
    position: 'relative',
  },
  replyAvatarColumn: {
    width: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  authorBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
    flex: 1,
  },
  authorName: {
    fontWeight: '600',
    fontSize: 14,
  },
  replyAuthorName: {
    fontSize: 13,
    fontWeight: '500',
  },
  authorBadge: {
    fontSize: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  mentionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  content: {
    lineHeight: 20,
    fontSize: 14,
  },
  replyContent: {
    lineHeight: 18,
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 0,
  },
  metaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  replyAction: {
    minHeight: 18,
    justifyContent: 'center',
  },
  replyActionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionPressed: {
    opacity: 0.7,
  },
  actionDisabled: {
    opacity: 0.5,
  },
  likeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    minHeight: 18,
  },
  likeIcon: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeCountSlot: {
    minWidth: 20,
    justifyContent: 'center',
  },
  actionCount: {
    textAlign: 'left',
    lineHeight: 16,
  },
  replySummaryButton: {
    marginTop: 4,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  replySummaryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
  },
  replyingText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
