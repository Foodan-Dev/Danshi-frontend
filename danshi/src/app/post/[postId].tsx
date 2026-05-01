import React from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Text } from 'react-native-paper';
import PostDetailScreen from '@/src/screens/post_detail_screen';

export default function PostDetailRoute() {
  const router = useRouter();
  const params = useLocalSearchParams<{ postId?: string | string[] }>();
  const postIdParam = params.postId;
  const postId = Array.isArray(postIdParam) ? postIdParam[0] : postIdParam;

  if (!postId) {
    return (
      <>
        <Stack.Screen options={{ title: '帖子详情' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ marginBottom: 12 }}>帖子ID缺失，无法打开详情页</Text>
          <Button mode="contained-tonal" onPress={() => router.replace('/explore')}>
            返回发现页
          </Button>
        </View>
      </>
    );
  }

  return <PostDetailScreen postId={postId} />;
}
