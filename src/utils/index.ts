import { Platform, type TextStyle } from 'react-native';

/**
 * 常用 Web 专属样式：去除 TextInput 默认 outline。
 * 在原生平台返回 undefined（不会应用任何样式）。
 *
 * 用法：style={[styles.input, WEB_NO_OUTLINE]}
 */
export const WEB_NO_OUTLINE: TextStyle | undefined = Platform.OS === 'web'
  // @ts-expect-error — outlineStyle 是 Web 专属 CSS 属性，RN 类型不含它
  ? { outlineStyle: 'none' }
  : undefined;
