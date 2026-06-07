import { Alert, Platform } from 'react-native';

/**
 * 跨平台 alert 辅助函数
 * - Web: 使用 window.alert
 * - Native: 使用 React Native Alert.alert
 */
export function showAlert(title: string, message?: string) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}: ${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

