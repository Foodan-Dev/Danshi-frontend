import React from 'react';
import { Alert, Linking, Platform, Pressable, type GestureResponderEvent } from 'react-native';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { isHttpOrHttpsUrl } from '@/src/lib/security/url';

type Props = React.ComponentProps<typeof Pressable> & { href: string };

export function ExternalLink({ href, onPress, ...rest }: Props) {
  const safeHref = isHttpOrHttpsUrl(href) ? href : undefined;
  const isDisabled = !!rest.disabled || !safeHref;
  const webLinkProps = Platform.OS === 'web' && safeHref
    ? ({
        href: safeHref,
        hrefAttrs: {
          target: '_blank',
          rel: 'noopener noreferrer',
        },
      } as const)
    : undefined;

  const handlePress: NonNullable<Props['onPress']> = async (event: GestureResponderEvent) => {
    try {
      if (onPress) onPress(event);
      if (event.defaultPrevented) return;

      if (!safeHref || Platform.OS === 'web') return;

      try {
        await openBrowserAsync(safeHref, { presentationStyle: WebBrowserPresentationStyle.AUTOMATIC });
      } catch {
        await Linking.openURL(safeHref);
      }
    } catch {
      Alert.alert('链接打开失败', '请稍后重试');
    }
  };

  return (
    <Pressable
      {...rest}
      {...(webLinkProps as any)}
      accessibilityRole="link"
      disabled={isDisabled}
      onPress={handlePress}
    />
  );
}
