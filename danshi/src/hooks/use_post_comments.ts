/**
 * usePostComments — 帖子评论管理 Hook
 *
 * 封装帖子详情页中的所有评论状态、加载、回复、点赞、删除逻辑，
 * 从 post_detail_screen 中提取以降低单文件复杂度。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { commentsService } from '@/src/services/comments_service';
import { adminService } from '@/src/services/admin_service';
import type { Comment, CommentEntity, CommentReply, CommentsPagination } from '@/src/models/Comment';
import { showAlert } from '@/src/utils/alert';

export const REPLY_PREVIEW_COUNT = 3;

/** 扁平化嵌套回复：将三级及更深的回复全部提升为二级 */
export function flattenReplies(replies: CommentReply[]): CommentReply[] {
  const result: CommentReply[] = [];
  for (const reply of replies) {
    const { replies: nestedReplies, ...replyWithoutNested } = reply as CommentReply & { replies?: CommentReply[] };
    result.push(replyWithoutNested);
    if (nestedReplies?.length) {
      result.push(...flattenReplies(nestedReplies));
    }
  }
  return result;
}

export type CommentActionItem = {
  key: string;
  title: string;
  icon?: string;
  destructive?: boolean;
  onPress: () => void;
};

type UsePostCommentsParams = {
  postId: string;
  currentUser: { id: string; role?: string } | null;
  isAdmin: boolean;
  /** 调用者用此回调更新 post.stats.comment_count */
  onCommentCountChange: (delta: number) => void;
};

export function usePostComments({ postId, currentUser, isAdmin: isCurrentUserAdmin, onCommentCountChange }: UsePostCommentsParams) {
  // ==================== State ====================
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentSort, setCommentSort] = useState<'latest' | 'hot'>('latest');
  const [commentPagination, setCommentPagination] = useState<CommentsPagination>({
    page: 1,
    limit: 10,
    total: 0,
    total_pages: 1,
  });
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [commentReplies, setCommentReplies] = useState<Record<string, CommentReply[]>>({});
  const [commentRepliesPagination, setCommentRepliesPagination] = useState<Record<string, CommentsPagination>>({});
  const [commentRepliesLoading, setCommentRepliesLoading] = useState<Record<string, boolean>>({});
  const [commentRepliesExpanded, setCommentRepliesExpanded] = useState<Record<string, boolean>>({});
  const [commentSheetVisible, setCommentSheetVisible] = useState(false);
  const [threadVisible, setThreadVisible] = useState(false);
  const [threadRootComment, setThreadRootComment] = useState<Comment | null>(null);
  const [commentInput, setCommentInput] = useState('');
  const [commentReplyTarget, setCommentReplyTarget] = useState<Comment | CommentReply | null>(null);

  // ==================== Refs ====================
  const commentSortRef = useRef<'latest' | 'hot'>(commentSort);
  const commentLikeLoadingRef = useRef<Set<string>>(new Set());
  const commentDeleteLoadingRef = useRef<Set<string>>(new Set());
  const replyRequestKeysRef = useRef<Set<string>>(new Set());
  const commentsRef = useRef<Comment[]>(comments);
  const commentRepliesRef = useRef<Record<string, CommentReply[]>>(commentReplies);
  const threadRootCommentRef = useRef<Comment | null>(threadRootComment);
  const fetchRepliesForCommentRef = useRef<(commentId: string, page?: number, append?: boolean) => Promise<void>>(
    async () => {}
  );

  // 同步 ref 与最新的 state
  commentsRef.current = comments;
  commentRepliesRef.current = commentReplies;
  threadRootCommentRef.current = threadRootComment;

  useEffect(() => {
    commentSortRef.current = commentSort;
  }, [commentSort]);

  // 同步 threadRootComment 与 comments 状态
  useEffect(() => {
    if (!threadRootComment) return;
    const updated = comments.find((c) => c.id === threadRootComment.id);
    if (updated && updated !== threadRootComment) {
      setThreadRootComment(updated);
    }
  }, [comments, threadRootComment]);

  // ==================== 数据获取 ====================
  const fetchComments = useCallback(async (postIdValue: string, sort: 'latest' | 'hot') => {
    setCommentLoading(true);
    setCommentError(null);
    try {
      const res = await commentsService.listByPost(postIdValue, { sortBy: sort, limit: 10 });
      // 为 replies 数组中的每个回复添加 parent_id（后端不返回此字段）
      const commentsWithParentId = res.comments.map((comment) => {
        if (comment.replies && comment.replies.length > 0) {
          const repliesWithParentId = comment.replies.map((reply) => ({
            ...reply,
            parent_id: comment.id,
          }));
          return { ...comment, replies: repliesWithParentId };
        }
        return comment;
      });

      setComments(commentsWithParentId);
      setCommentPagination(res.pagination);
      // 清理不再存在的评论的关联数据
      const commentIds = new Set(commentsWithParentId.map((c) => c.id));
      setCommentReplies((prev) => {
        if (!Object.keys(prev).length) return prev;
        const next: Record<string, CommentReply[]> = {};
        for (const id of Object.keys(prev)) {
          if (commentIds.has(id)) next[id] = prev[id];
        }
        return next;
      });
      setCommentRepliesPagination((prev) => {
        if (!Object.keys(prev).length) return prev;
        const next: Record<string, CommentsPagination> = {};
        for (const id of Object.keys(prev)) {
          if (commentIds.has(id)) next[id] = prev[id];
        }
        return next;
      });
      setCommentRepliesExpanded((prev) => {
        if (!Object.keys(prev).length) return prev;
        const next: Record<string, boolean> = {};
        for (const id of Object.keys(prev)) {
          if (commentIds.has(id)) next[id] = prev[id];
        }
        return next;
      });
    } catch (e) {
      setCommentError((e as Error)?.message ?? '加载评论失败');
      if (__DEV__) console.warn('load comments failed', e);
    } finally {
      setCommentLoading(false);
    }
  }, []);

  const fetchRepliesForComment = useCallback(async (commentId: string, page = 1, append = false) => {
    const requestKey = `${commentId}:${page}:${append ? 'append' : 'replace'}`;
    if (replyRequestKeysRef.current.has(requestKey)) {
      return;
    }
    replyRequestKeysRef.current.add(requestKey);
    setCommentRepliesLoading((prev) => ({ ...prev, [commentId]: true }));
    try {
      const res = await commentsService.listReplies(commentId, { limit: 20, page });
      const repliesWithParentId = (res.replies ?? []).map((reply) => ({
        ...reply,
        parent_id: commentId,
      }));
      const flattened = flattenReplies(repliesWithParentId);
      setCommentReplies((prev) => {
        const existing = append ? prev[commentId] ?? [] : [];
        const merged = append ? [...existing, ...flattened] : flattened;
        const deduped = Array.from(new Map(merged.map((reply) => [reply.id, reply])).values());
        return { ...prev, [commentId]: deduped };
      });
      setCommentRepliesPagination((prev) => ({ ...prev, [commentId]: res.pagination }));
    } catch (e) {
      if (__DEV__) console.error('[fetchRepliesForComment] error:', e);
      showAlert('加载失败', (e as Error)?.message ?? '暂时无法加载更多回复');
    } finally {
      replyRequestKeysRef.current.delete(requestKey);
      setCommentRepliesLoading((prev) => ({ ...prev, [commentId]: false }));
    }
  }, []);
  fetchRepliesForCommentRef.current = fetchRepliesForComment;

  // ==================== 查找辅助 ====================
  const findCommentTarget = useCallback((commentId: string) => {
    const topComment = commentsRef.current.find((c) => c.id === commentId);
    if (topComment) return { entity: topComment, parent: topComment };

    for (const c of commentsRef.current) {
      const reply = c.replies?.find((r) => r.id === commentId);
      if (reply) return { entity: reply, parent: c };
    }

    for (const [rootId, replies] of Object.entries(commentRepliesRef.current)) {
      const reply = replies.find((r) => r.id === commentId);
      if (reply) {
        const parent = commentsRef.current.find((c) => c.id === rootId) ?? null;
        return { entity: reply, parent };
      }
    }
    return null;
  }, []);

  const findLatestCommentById = useCallback((commentId: string): { is_liked?: boolean; like_count?: number } | null => {
    if (threadRootCommentRef.current?.id === commentId) return threadRootCommentRef.current;
    const topComment = commentsRef.current.find((c) => c.id === commentId);
    if (topComment) return topComment;
    for (const c of commentsRef.current) {
      const reply = c.replies?.find((r) => r.id === commentId);
      if (reply) return reply;
    }
    for (const replies of Object.values(commentRepliesRef.current)) {
      const reply = replies.find((r) => r.id === commentId);
      if (reply) return reply;
    }
    return null;
  }, []);

  // ==================== 状态补丁 ====================
  const patchCommentEntity = useCallback((targetId: string, patch: Partial<Comment | CommentReply>) => {
    setComments((prev) => {
      const next = prev.map((comment) => {
        if (comment.id === targetId) return { ...comment, ...patch } as Comment;
        if (!comment.replies?.length) return comment;
        const replies = comment.replies.map((reply) =>
          reply.id === targetId ? { ...reply, ...patch } as CommentReply : reply
        );
        return { ...comment, replies };
      });
      return next;
    });
    setCommentReplies((prev) => {
      const next: Record<string, CommentReply[]> = {};
      for (const [parentId, list] of Object.entries(prev)) {
        next[parentId] = list.map((reply) =>
          reply.id === targetId ? { ...reply, ...patch } as CommentReply : reply
        );
      }
      return next;
    });
    setThreadRootComment((prev) => {
      if (!prev) return prev;
      if (prev.id === targetId) return { ...prev, ...patch } as Comment;
      if (prev.replies?.length) {
        const updatedReplies = prev.replies.map((reply) =>
          reply.id === targetId ? { ...reply, ...patch } as CommentReply : reply
        );
        if (updatedReplies.some((r, idx) => r !== prev.replies![idx])) {
          return { ...prev, replies: updatedReplies };
        }
      }
      return prev;
    });
  }, []);

  // ==================== 点赞 ====================
  const handleToggleCommentLikeById = useCallback(async (commentId: string) => {
    if (commentLikeLoadingRef.current.has(commentId)) return;
    commentLikeLoadingRef.current.add(commentId);

    const latestEntity = findLatestCommentById(commentId);
    if (!latestEntity) {
      commentLikeLoadingRef.current.delete(commentId);
      return;
    }

    const currentlyLiked = latestEntity.is_liked ?? false;
    const currentLikeCount = latestEntity.like_count ?? 0;

    patchCommentEntity(commentId, {
      is_liked: !currentlyLiked,
      like_count: currentLikeCount + (currentlyLiked ? -1 : 1),
    });

    try {
      const result = currentlyLiked
        ? await commentsService.unlike(commentId)
        : await commentsService.like(commentId);
      patchCommentEntity(commentId, {
        is_liked: result?.is_liked ?? !currentlyLiked,
        like_count: result?.like_count ?? currentLikeCount + (currentlyLiked ? -1 : 1),
      });
    } catch {
      patchCommentEntity(commentId, { is_liked: currentlyLiked, like_count: currentLikeCount });
    } finally {
      commentLikeLoadingRef.current.delete(commentId);
    }
  }, [patchCommentEntity, findLatestCommentById]);

  const handleToggleCommentLike = useCallback((entity: Comment | CommentReply) => {
    handleToggleCommentLikeById(entity.id);
  }, [handleToggleCommentLikeById]);

  // ==================== 删除 ====================
  const handleDeleteCommentByEntity = useCallback(async (entity: CommentEntity) => {
    const targetId = entity.id;
    if (commentDeleteLoadingRef.current.has(targetId)) return;
    commentDeleteLoadingRef.current.add(targetId);
    try {
      if (isCurrentUserAdmin) {
        await adminService.deleteComment(targetId);
      } else {
        await commentsService.remove(targetId);
      }

      await fetchComments(postId, commentSortRef.current);

      if (threadRootComment?.id === targetId) {
        setThreadVisible(false);
        setThreadRootComment(null);
      } else if (threadRootComment) {
        await fetchRepliesForCommentRef.current(threadRootComment.id).catch(() => {});
      }

      onCommentCountChange(-1);
    } catch (e) {
      showAlert('删除失败', (e as Error)?.message ?? '暂时无法删除这条评论');
    } finally {
      commentDeleteLoadingRef.current.delete(targetId);
    }
  }, [postId, isCurrentUserAdmin, fetchComments, threadRootComment, onCommentCountChange]);

  const handleConfirmDeleteComment = useCallback((entity: CommentEntity) => {
    Alert.alert(
      '删除评论',
      '确定要删除这条评论吗？此操作不可撤销。',
      [
        { text: '取消', style: 'cancel' },
        { text: '删除', style: 'destructive', onPress: () => { handleDeleteCommentByEntity(entity).catch(() => {}); } },
      ]
    );
  }, [handleDeleteCommentByEntity]);

  // ==================== 评论输入 & 回复 ====================
  const handleOpenCommentSheet = useCallback(() => {
    if (!currentUser?.id) {
      showAlert('请先登录', '登录后才能发表评论');
      return;
    }
    setCommentSheetVisible(true);
  }, [currentUser?.id]);

  const handleReplyToComment = useCallback((entity: Comment | CommentReply) => {
    if (!currentUser?.id) {
      showAlert('请先登录', '登录后才能回复评论');
      return;
    }
    setCommentReplyTarget(entity);
    setCommentSheetVisible(true);
  }, [currentUser?.id]);

  const getCommentMoreActions = useCallback((entity: CommentEntity): CommentActionItem[] => {
    const canDeleteAsOwner = !!currentUser?.id && !!entity.author?.id && entity.author.id === currentUser.id;
    const canDelete = isCurrentUserAdmin || canDeleteAsOwner;
    const actions: CommentActionItem[] = [
      {
        key: 'reply',
        title: '回复',
        icon: 'reply',
        onPress: () => handleReplyToComment(entity),
      },
    ];
    if (canDelete) {
      actions.push({
        key: 'delete',
        title: '删除',
        icon: 'delete',
        destructive: true,
        onPress: () => handleConfirmDeleteComment(entity),
      });
    }
    return actions;
  }, [currentUser, isCurrentUserAdmin, handleReplyToComment, handleConfirmDeleteComment]);

  const handleCancelReply = useCallback(() => setCommentReplyTarget(null), []);

  const handleCloseCommentSheet = useCallback(() => {
    setCommentSheetVisible(false);
    setCommentReplyTarget(null);
  }, []);

  // ==================== 提交评论 ====================
  const handleSubmitComment = useCallback(async () => {
    const content = commentInput.trim();
    if (!content || commentSubmitting) return;
    if (!currentUser?.id) {
      showAlert('请先登录', '登录后才能发表评论');
      return;
    }
    setCommentSubmitting(true);
    try {
      let parent_id: string | undefined;
      let reply_to_user_id: string | undefined;
      let rootCommentId: string | undefined;

      if (commentReplyTarget) {
        parent_id = commentReplyTarget.id;
        reply_to_user_id = commentReplyTarget.author?.id;

        if (!commentReplyTarget.parent_id) {
          rootCommentId = commentReplyTarget.id;
        } else {
          const target = findCommentTarget(commentReplyTarget.id);
          if (target?.parent) {
            rootCommentId = target.parent.id;
          } else {
            rootCommentId = commentReplyTarget.parent_id;
          }
        }
      }

      const createdResponse = await commentsService.create(postId, {
        content,
        parent_id,
        reply_to_user_id,
      });

      const createdEntity = (createdResponse as any)?.comment || createdResponse;

      const isReply = !!parent_id;
      if (isReply && createdEntity && rootCommentId) {
        const newReply: CommentReply = {
          ...(createdEntity as CommentReply),
          parent_id: rootCommentId,
        };

        let updatedReplyLength = 0;
        setCommentReplies((prev) => {
          const prevList = prev[rootCommentId!] ?? [];
          const merged = [newReply, ...prevList];
          updatedReplyLength = merged.length;
          return { ...prev, [rootCommentId!]: merged };
        });
        setCommentRepliesPagination((prev) => {
          const prevPagination = prev[rootCommentId!];
          const limit = prevPagination?.limit ?? 20;
          const total = prevPagination?.total != null
            ? prevPagination.total + 1
            : updatedReplyLength;
          const total_pages = Math.max(1, Math.ceil(total / limit));
          return {
            ...prev,
            [rootCommentId!]: {
              page: prevPagination?.page ?? 1,
              limit,
              total,
              total_pages,
            },
          };
        });
        setComments((prev) => prev.map((comment) => {
          if (comment.id !== rootCommentId) return comment;
          const previewSource = flattenReplies(comment.replies ?? []);
          const preview = [newReply, ...previewSource].slice(0, REPLY_PREVIEW_COUNT);
          return {
            ...comment,
            reply_count: (comment.reply_count ?? 0) + 1,
            replies: preview,
          };
        }));
      } else if (!isReply && createdEntity) {
        const newComment = createdEntity as Comment;
        setComments((prev) => [newComment, ...prev]);
        setCommentPagination((prev) => {
          const limit = (prev as CommentsPagination).limit ?? 10;
          const total = (prev.total ?? 0) + 1;
          const total_pages = Math.max(1, Math.ceil(total / limit));
          return { ...prev, limit, total, total_pages };
        });
      }

      setCommentInput('');
      setCommentReplyTarget(null);
      setCommentSheetVisible(false);
      await fetchComments(postId, commentSort);

      if (rootCommentId) {
        try {
          await fetchRepliesForComment(rootCommentId);
        } catch {
          if (__DEV__) console.warn('auto refresh replies failed');
        }
      }

      onCommentCountChange(1);
    } catch (e) {
      showAlert('评论失败', (e as Error)?.message ?? '暂时无法发表评论');
    } finally {
      setCommentSubmitting(false);
    }
  }, [commentInput, commentReplyTarget, postId, currentUser?.id, findCommentTarget, fetchComments, commentSort, fetchRepliesForComment, onCommentCountChange, commentSubmitting]);

  // ==================== 排序切换 ====================
  const handleCycleCommentSort = useCallback(() => {
    setCommentSort((prev) => (prev === 'latest' ? 'hot' : 'latest'));
  }, []);

  // ==================== 回复面板 ====================
  const handleShowRepliesPanel = useCallback((entity: CommentEntity) => {
    const isRootComment = !entity.parent_id;
    const rootComment = isRootComment
      ? (entity as Comment)
      : comments.find((c) => c.id === entity.parent_id) ?? null;

    if (!rootComment) return;
    setThreadRootComment(rootComment);
    setThreadVisible(true);
    if (!commentReplies[rootComment.id] && rootComment.replies?.length) {
      setCommentReplies((prev) => ({
        ...prev,
        [rootComment.id]: flattenReplies(rootComment.replies ?? []),
      }));
    }
    const hasReplies = commentReplies[rootComment.id]?.length;
    if (!hasReplies && (rootComment.reply_count ?? 0) > 0) {
      fetchRepliesForComment(rootComment.id).catch(() => {});
    }
  }, [comments, commentReplies, fetchRepliesForComment]);

  const handleCloseThreadSheet = useCallback(() => {
    setThreadVisible(false);
  }, []);

  const handleLoadMoreThreadReplies = useCallback(() => {
    if (!threadRootComment) return;
    if (commentRepliesLoading[threadRootComment.id]) return;
    const pagination = commentRepliesPagination[threadRootComment.id];
    const nextPage = (pagination?.page ?? 1) + 1;
    if (pagination && nextPage > (pagination.total_pages ?? Infinity)) return;
    fetchRepliesForComment(threadRootComment.id, nextPage, true).catch(() => {});
  }, [threadRootComment, commentRepliesLoading, commentRepliesPagination, fetchRepliesForComment]);

  const handleReloadThreadReplies = useCallback(() => {
    if (!threadRootComment) return;
    fetchRepliesForComment(threadRootComment.id).catch(() => {});
  }, [threadRootComment, fetchRepliesForComment]);

  const handleDesktopToggleReplies = useCallback((comment: Comment) => {
    setCommentRepliesExpanded((prev) => {
      const nextExpanded = !prev[comment.id];
      if (nextExpanded && !commentReplies[comment.id]) {
        fetchRepliesForComment(comment.id).catch(() => {});
      }
      return { ...prev, [comment.id]: nextExpanded };
    });
  }, [commentReplies, fetchRepliesForComment]);

  // ==================== 派生数据 ====================
  const threadRepliesList = threadRootComment ? commentReplies[threadRootComment.id] ?? [] : [];
  const threadPaginationInfo = threadRootComment ? commentRepliesPagination[threadRootComment.id] : undefined;
  const threadReplyTotal = Math.max(
    threadPaginationInfo?.total ?? threadRootComment?.reply_count ?? 0,
    threadRepliesList.length,
  );
  const threadLoading = threadRootComment ? !!commentRepliesLoading[threadRootComment.id] : false;
  const threadHasMore = threadReplyTotal > threadRepliesList.length;

  return {
    // State
    comments,
    commentSort,
    commentPagination,
    commentLoading,
    commentSubmitting,
    commentError,
    commentReplies,
    commentRepliesLoading,
    commentRepliesPagination,
    commentRepliesExpanded,
    commentSheetVisible,
    threadVisible,
    threadRootComment,
    commentInput,
    setCommentInput,
    commentReplyTarget,
    // Derived
    threadRepliesList,
    threadReplyTotal,
    threadLoading,
    threadHasMore,
    // Data fetching
    fetchComments,
    fetchRepliesForComment,
    // Handlers
    handleToggleCommentLike,
    handleReplyToComment,
    getCommentMoreActions,
    handleCancelReply,
    handleOpenCommentSheet,
    handleCloseCommentSheet,
    handleSubmitComment,
    handleCycleCommentSort,
    handleShowRepliesPanel,
    handleCloseThreadSheet,
    handleLoadMoreThreadReplies,
    handleReloadThreadReplies,
    handleDesktopToggleReplies,
    // Utilities (for scroll handling in parent)
    findCommentTarget,
    commentsRef,
    fetchRepliesForCommentRef,
  };
}
