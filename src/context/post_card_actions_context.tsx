import React, { createContext, type PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { ActionSheet, type ActionSheetItem } from '@/src/components/overlays/action_sheet';

type PostCardActionTarget = {
  postId: number;
  onEdit?: (postId: number) => void;
  onDelete?: (postId: number) => void;
};

type PostCardActionsContextValue = {
  openPostCardActions: (target: PostCardActionTarget) => void;
};

const PostCardActionsContext = createContext<PostCardActionsContextValue | null>(null);

export function PostCardActionsProvider({ children }: PropsWithChildren) {
  const [target, setTarget] = useState<PostCardActionTarget | null>(null);

  const closeActions = useCallback(() => setTarget(null), []);
  const openPostCardActions = useCallback((nextTarget: PostCardActionTarget) => {
    setTarget(nextTarget);
  }, []);

  const items = useMemo<ActionSheetItem[]>(() => {
    if (!target) return [];

    const nextItems: ActionSheetItem[] = [];
    if (target.onEdit) {
      nextItems.push({
        key: 'edit',
        title: '编辑',
        icon: 'pencil',
        onPress: () => target.onEdit?.(target.postId),
      });
    }
    if (target.onDelete) {
      nextItems.push({
        key: 'delete',
        title: '删除',
        icon: 'delete',
        destructive: true,
        onPress: () => {
          const doDelete = () => target.onDelete?.(target.postId);
          if (Platform.OS === 'web') {
            if (window.confirm('删除后无法恢复，确定要删除这篇帖子吗？')) {
              doDelete();
            }
            return;
          }
          Alert.alert('确认删除', '删除后无法恢复，确定要删除这篇帖子吗？', [
            { text: '取消', style: 'cancel' },
            { text: '删除', style: 'destructive', onPress: doDelete },
          ]);
        },
      });
    }
    return nextItems;
  }, [target]);

  const value = useMemo(() => ({ openPostCardActions }), [openPostCardActions]);

  return (
    <PostCardActionsContext.Provider value={value}>
      {children}
      <ActionSheet
        visible={target !== null}
        title="帖子操作"
        items={items}
        onClose={closeActions}
      />
    </PostCardActionsContext.Provider>
  );
}

export function usePostCardActions() {
  const context = useContext(PostCardActionsContext);
  if (!context) {
    throw new Error('usePostCardActions must be used within PostCardActionsProvider');
  }
  return context;
}
