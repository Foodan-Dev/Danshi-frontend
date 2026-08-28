import React, {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { Post, PostCreateResult } from '@/src/models/Post';
import { postsService } from '@/src/services/posts_service';

export type PostChangeKind = 'create' | 'update' | 'delete';

export type PostChange = {
  sequence: number;
  postId: number;
  kind: PostChangeKind;
  status?: PostCreateResult['status'];
  post?: Post;
  settled: boolean;
  fetchFailed?: boolean;
};

type ReportPostChangeInput = Omit<PostChange, 'sequence' | 'settled' | 'fetchFailed'>;

type PostChangesContextValue = {
  changes: readonly PostChange[];
  reportPostChange: (change: ReportPostChangeInput) => void;
};

const PostChangesContext = createContext<PostChangesContextValue | undefined>(undefined);

export function PostChangesProvider({ children }: PropsWithChildren) {
  const [changes, setChanges] = useState<PostChange[]>([]);
  const sequenceRef = useRef(0);

  const reportPostChange = useCallback((change: ReportPostChangeInput) => {
    const sequence = ++sequenceRef.current;
    const pendingChange: PostChange = {
      ...change,
      sequence,
      settled: change.kind === 'delete',
    };
    setChanges((current) => [...current, pendingChange]);

    if (change.kind === 'delete') return;

    void postsService.get(change.postId)
      .then((post) => {
        setChanges((current) => current.map((item) => (
          item.sequence === sequence ? { ...item, post, settled: true } : item
        )));
      })
      .catch(() => {
        setChanges((current) => current.map((item) => (
          item.sequence === sequence ? { ...item, settled: true, fetchFailed: true } : item
        )));
      });
  }, []);

  const value = useMemo<PostChangesContextValue>(
    () => ({ changes, reportPostChange }),
    [changes, reportPostChange],
  );

  return (
    <PostChangesContext.Provider value={value}>
      {children}
    </PostChangesContext.Provider>
  );
}

export function usePostChanges() {
  const context = useContext(PostChangesContext);
  if (!context) {
    throw new Error('usePostChanges must be used within PostChangesProvider');
  }
  return context;
}
