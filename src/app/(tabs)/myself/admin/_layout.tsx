import { Redirect, Stack } from 'expo-router';
import { useAuth } from '@/src/context/auth_context';
import { isAdmin } from '@/src/lib/auth/roles';

export default function AdminLayout() {
  const { isLoading, userToken, user } = useAuth();

  if (isLoading) return null;
  if (!userToken) return <Redirect href="/login" />;
  if (!user || !isAdmin(user.role)) return <Redirect href="/(tabs)/myself" />;

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="posts" />
      <Stack.Screen name="users" />
      <Stack.Screen name="comments" />
    </Stack>
  );
}
