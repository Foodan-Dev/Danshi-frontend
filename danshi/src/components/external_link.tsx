import React from 'react';
import { Platform, Pressable, type GestureResponderEvent } from 'react-native';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';
import { isHttpOrHttpsUrl } from '@/src/lib/security/url';

type Props = React.ComponentProps<typeof Pressable> & { href: string };

export function ExternalLink({ href, onPress, ...rest }: Props) {
  const handlePress: NonNullable<Props['onPress']> = async (event: GestureResponderEvent) => {
    try {
      if (onPress) onPress(event);
      if (event.defaultPrevented) return;
      if (!isHttpOrHttpsUrl(href)) return;
      if (Platform.OS === 'web') {
        window.open(href, '_blank', 'noopener,noreferrer');
      } else {
        await openBrowserAsync(href, { presentationStyle: WebBrowserPresentationStyle.AUTOMATIC });
      }
    } catch {
      // noop: swallow open errors
    }
  };

  return <Pressable accessibilityRole="link" onPress={handlePress} {...rest} />;
}
