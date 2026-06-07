import React, { useCallback, useEffect, useState } from 'react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import PostScreen from '@/src/screens/post_screen';
import { postsService } from '@/src/services/posts_service';
import { AppError } from '@/src/lib/errors/app_error';
import type { Post } from '@/src/models/Post';

export default function EditPostPage() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const postIdParam = params.postId;
  const postId = Array.isArray(postIdParam) ? postIdParam[0] : postIdParam;
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    if (postId) {
      router.replace(`/post/${postId}`);
      return;
    }
    router.replace('/myself/posts');
  }, [postId, router]);

  const loadPost = useCallback(async () => {
    if (!postId) return;
    
    setLoading(true);
    try {
      const postData = await postsService.get(postId);
      setPost(postData);
    } catch (err) {
      const message = err instanceof AppError ? err.message : '加载帖子失败';
      Alert.alert('加载失败', message, [
        {
          text: '返回',
          onPress: handleBack,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [handleBack, postId]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  const handleUpdateSuccess = useCallback(() => {
    handleBack();
  }, [handleBack]);

  if (!postId) {
    return (
      <>
        <Stack.Screen options={{ title: '编辑帖子' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ marginBottom: 12 }}>帖子ID缺失，无法进入编辑页</Text>
          <Button mode="contained-tonal" onPress={handleBack}>
            返回
          </Button>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: '编辑帖子' }} />
      <PostScreen 
        editMode={true}
        editPostId={postId}
        initialData={post}
        loading={loading}
        onUpdateSuccess={handleUpdateSuccess}
      />
    </>
  );
}
