import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react';

import { usePostChanges } from '@/src/context/post_changes_context';
import type { Post } from '@/src/models/Post';

type PostChangeSyncOptions<Item> = {
  setItems: Dispatch<SetStateAction<Item[]>>;
  getPostId: (item: Item) => number;
  mapPost: (post: Post, existing: Item | undefined) => Item;
  publicOnly?: boolean;
  insertNew?: boolean;
};

type AppliedPhase = 'optimistic' | 'resolved';

export function usePostChangeSync<Item>({
  setItems,
  getPostId,
  mapPost,
  publicOnly = false,
  insertNew = false,
}: PostChangeSyncOptions<Item>) {
  const { changes } = usePostChanges();
  const mountedAtSequenceRef = useRef(changes.at(-1)?.sequence ?? 0);
  const appliedPhasesRef = useRef(new Map<number, AppliedPhase>());

  useEffect(() => {
    const latestSequenceByPost = new Map<number, number>();
    for (const change of changes) {
      latestSequenceByPost.set(change.postId, change.sequence);
    }

    for (const change of changes) {
      if (change.sequence <= mountedAtSequenceRef.current) continue;
      if (latestSequenceByPost.get(change.postId) !== change.sequence) continue;

      const appliedPhase = appliedPhasesRef.current.get(change.sequence);
      const shouldRemove = change.kind === 'delete'
        || (publicOnly && change.status !== undefined && change.status !== 'approved');

      if (shouldRemove && !appliedPhase) {
        setItems((current) => current.filter((item) => getPostId(item) !== change.postId));
        appliedPhasesRef.current.set(
          change.sequence,
          change.settled ? 'resolved' : 'optimistic',
        );
      }

      if (change.kind === 'delete' || !change.post || appliedPhase === 'resolved') continue;

      if (publicOnly && change.post.status !== 'approved') {
        setItems((current) => current.filter((item) => getPostId(item) !== change.postId));
        appliedPhasesRef.current.set(
          change.sequence,
          change.settled ? 'resolved' : 'optimistic',
        );
        continue;
      }

      setItems((current) => {
        const index = current.findIndex((item) => getPostId(item) === change.postId);
        if (index < 0) {
          return insertNew && change.kind === 'create'
            ? [mapPost(change.post!, undefined), ...current]
            : current;
        }
        const next = [...current];
        next[index] = mapPost(change.post!, current[index]);
        return next;
      });
      appliedPhasesRef.current.set(
        change.sequence,
        change.settled ? 'resolved' : 'optimistic',
      );
    }
  }, [changes, getPostId, insertNew, mapPost, publicOnly, setItems]);
}
