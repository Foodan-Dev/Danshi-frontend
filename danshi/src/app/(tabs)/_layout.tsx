import React from 'react';
import { View, StyleSheet, Platform, useWindowDimensions, Pressable, Text as RNText, Image } from 'react-native';
import { Tabs, Redirect, usePathname, useRouter, type Href } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/src/context/theme_context';
import { HapticTab } from '@/src/components/haptic_tab';
import { useAuth } from '@/src/context/auth_context';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { breakpoints } from '@/src/constants/breakpoints';
import { getSafeRemoteUrl } from '@/src/lib/security/url';

// 侧边栏导航项
const SIDEBAR_ITEMS = [
  { name: 'explore', title: '发现', icon: 'compass', iconOutline: 'compass-outline', href: '/(tabs)/explore' },
  { name: 'post', title: '发布', icon: 'add-circle', iconOutline: 'add-circle-outline', href: '/(tabs)/post' },
  { name: 'myself', title: '我的', icon: 'person', iconOutline: 'person-outline', href: '/(tabs)/myself' },
];

// 侧边栏组件
function Sidebar() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const safeUserAvatarUrl = getSafeRemoteUrl(user?.avatar_url);

  const getActiveTab = () => {
    if (pathname.includes('/explore')) return 'explore';
    if (pathname.includes('/post')) return 'post';
    if (pathname.includes('/myself')) return 'myself';
    return 'explore';
  };

  const activeTab = getActiveTab();

  return (
    <View
      style={[
        styles.sidebar,
        {
          backgroundColor: theme.colors.surfaceContainerLow,
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 16,
          borderRightColor: theme.effective === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
        },
      ]}
    >
      {/* 用户头像 */}
      <Pressable 
        style={styles.sidebarAvatar}
        onPress={() => router.push('/(tabs)/myself')}
      >
        {safeUserAvatarUrl ? (
          <Image
            source={{ uri: safeUserAvatarUrl }}
            style={styles.avatarImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: theme.colors.surfaceVariant }]}>
            <Ionicons name="person" size={26} color={theme.colors.onSurfaceVariant} />
          </View>
        )}
      </Pressable>

      {/* 导航项 */}
      <View style={styles.sidebarNav}>
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = activeTab === item.name;
          const iconName = isActive ? item.icon : item.iconOutline;

          return (
            <Pressable
              key={item.name}
              style={({ pressed }) => [
                styles.sidebarItem,
                isActive && {
                  backgroundColor: theme.effective === 'dark' ? 'rgba(249,115,22,0.15)' : 'rgba(249,115,22,0.1)',
                },
                pressed && {
                  backgroundColor: theme.effective === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                },
              ]}
              onPress={() => router.push(item.href as Href)}
            >
              <Ionicons
                name={iconName as React.ComponentProps<typeof Ionicons>['name']}
                size={24}
                color={isActive ? theme.colors.primary : theme.colors.onSurfaceVariant}
              />
              <RNText
                style={[
                  styles.sidebarLabel,
                  {
                    color: isActive ? theme.colors.primary : theme.colors.onSurfaceVariant,
                    fontWeight: isActive ? '600' : '400',
                  },
                ]}
              >
                {item.title}
              </RNText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const theme = useTheme();
  const { userToken, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const pathname = usePathname();
  
  // 与评论界面底部栏保持一致: minHeight 56 + paddingBottom (Math.max(insets.bottom, 12))
  const tabBarBaseHeight = 56;
  const tabBarPadding = Math.max(insets.bottom, 12);
  const tabBarTotalHeight = tabBarBaseHeight + tabBarPadding;

  // 是否显示侧边栏
  const showSidebar = windowWidth >= breakpoints.md;
  
  // 是否在管理界面（隐藏底部栏）
  const isInAdminRoute = pathname.includes('/myself/admin');

  // 在这些子页面中隐藏 TabBar（发现/发布/我的）
  const isInMyselfSubscreen =
    pathname.includes('/myself/posts') ||
    pathname.includes('/myself/settings') ||
    pathname.includes('/myself/followers') ||
    pathname.includes('/myself/following');
  const isInSearchRoute = pathname.includes('/search');
  const shouldHideTabBar = showSidebar || isInAdminRoute || isInMyselfSubscreen || isInSearchRoute;

  const screenOptions = React.useMemo(
    () => ({
      headerShown: false,
      tabBarStyle: shouldHideTabBar
        ? { display: 'none' as const }
        : {
            position: 'absolute' as const,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: Platform.OS === 'ios' ? 'transparent' : (theme.effective === 'dark' ? 'rgba(30,30,30,0.95)' : 'rgba(255,255,255,0.95)'),
            borderTopWidth: 0,
            elevation: 8,
            zIndex: 100,
            height: tabBarTotalHeight,
            overflow: 'visible' as const,
          },
      tabBarBackground: () =>
        Platform.OS === 'ios' && !showSidebar && !isInAdminRoute ? (
          <BlurView
            intensity={80}
            tint={theme.effective === 'dark' ? 'dark' : 'light'}
            style={StyleSheet.absoluteFill}
          />
        ) : null,
      sceneContainerStyle: {
        backgroundColor: theme.background,
        paddingBottom: shouldHideTabBar ? 0 : tabBarTotalHeight,
      },
      tabBarActiveTintColor: theme.colors.primary,
      tabBarInactiveTintColor: theme.colors.onSurfaceVariant,
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' as const },
      tabBarButton: (props: any) => <HapticTab {...props} />,
      animation: 'none' as const,
      lazy: true,
      freezeOnBlur: true,
    }),
    [theme, tabBarPadding, tabBarTotalHeight, shouldHideTabBar]
  );

  if (isLoading) return null;
  if (!userToken) {
    return <Redirect href="/login" />;
  }

  // 宽屏布局：侧边栏 + 内容区
  if (showSidebar) {
    return (
      <View style={styles.wideContainer}>
        <Sidebar />
        <View style={styles.wideContent}>
          <Tabs initialRouteName="explore" screenOptions={screenOptions}>
            <Tabs.Screen
              name="explore"
              options={{
                title: '发现',
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons name={focused ? 'compass' : 'compass-outline'} size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="post"
              options={{
                title: '',
                tabBarIcon: () => (
                  <View style={[styles.fabContainer, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}>
                    <Ionicons name="add" size={28} color={theme.colors.onPrimary} />
                  </View>
                ),
                tabBarLabelStyle: { display: 'none' },
              }}
            />
            <Tabs.Screen
              name="myself"
              options={{
                title: '我的',
                tabBarIcon: ({ color, size, focused }) => (
                  <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="search"
              options={{
                href: null, // 从 Tab Bar 中隐藏
              }}
            />
          </Tabs>
        </View>
      </View>
    );
  }

  // 窄屏布局：底部 Tab Bar（半透明磨砂背景）
  return (
    <Tabs initialRouteName="explore" screenOptions={screenOptions}>
      <Tabs.Screen
        name="explore"
        options={{
          title: '发现',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'compass' : 'compass-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="post"
        options={{
          title: '发布',
          tabBarIcon: ({ color, focused }) => (
            <View style={[styles.addIconContainer, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="add" size={22} color={theme.colors.onPrimary} />
            </View>
          ),
          tabBarStyle: { display: 'none' },
          sceneContainerStyle: { paddingBottom: 0 },
        }}
      />
      <Tabs.Screen
        name="myself"
        options={{
          title: '我的',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          href: null, // 从 Tab Bar 中隐藏
          tabBarStyle: { display: 'none' },
          sceneContainerStyle: { paddingBottom: 0 },
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // 宽屏容器
  wideContainer: {
    flex: 1,
    flexDirection: 'row',
  },
  wideContent: {
    flex: 1,
  },

  // 侧边栏
  sidebar: {
    width: 280,
    borderRightWidth: 1,
    paddingHorizontal: 20,
  },
  sidebarAvatar: {
    paddingHorizontal: 12,
    paddingBottom: 28,
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
  sidebarNav: {
    flex: 1,
    gap: 6,
  },
  sidebarItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  sidebarLabel: {
    fontSize: 16,
  },

  // FAB 按钮（宽屏侧边栏）
  fabContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  // 发布按钮（窄屏底部导航栏 - 圆角矩形加号）
  addIconContainer: {
    width: 28,
    height: 24,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
