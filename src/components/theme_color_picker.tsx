import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, StyleSheet, TextInput, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Modal, Pressable, Animated, Easing } from 'react-native';
import { 
  Text, 
  useTheme as usePaperTheme, 
  Button, 
  IconButton 
} from 'react-native-paper';
import ColorPicker, { 
  HueCircular, 
  Panel1, 
  type ColorFormatsObject 
} from 'reanimated-color-picker';
import { useTheme } from '@/src/context/theme_context';
import { isValidHex } from '@/src/lib/theme/color_generator';

type Props = {
  visible: boolean;
  onDismiss: () => void;
};

export const ThemeColorPicker: React.FC<Props> = ({ visible, onDismiss }) => {
  const theme = usePaperTheme();
  const { accentColor, setAccentColor, resetAccentColor } = useTheme();
  const pickerRef = useRef<{ setColor: (color: string, duration?: number) => void } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.98)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const initialColorRef = useRef((accentColor || theme.colors.primary).toUpperCase());
  const [mounted, setMounted] = useState(visible);
  const [saving, setSaving] = useState(false);

  const initialColor = (accentColor || theme.colors.primary).toUpperCase();
  const [selectedColor, setSelectedColor] = useState(initialColor);
  const [hexInput, setHexInput] = useState(initialColor);
  const [hexError, setHexError] = useState('');
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    initialColorRef.current = (accentColor || theme.colors.primary).toUpperCase();
  }, [accentColor, theme.colors.primary]);

  // 弹窗打开时重置状态
  useEffect(() => {
    if (visible) {
      setMounted(true);
      const current = initialColorRef.current;
      setSelectedColor(current);
      setHexInput(current);
      setHexError('');
      setActionError('');
      pickerRef.current?.setColor(current, 0);
      animationRef.current?.stop();
      animationRef.current = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 140,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
    } else {
      animationRef.current?.stop();
      animationRef.current = Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 110,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 0.98,
          duration: 110,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]);
    }
    animationRef.current?.start(({ finished }) => {
      if (finished && !visible) {
        setMounted(false);
      }
    });

    return () => {
      animationRef.current?.stop();
    };
  }, [visible, opacity, scale]);

  // 颜色改变回调（拖拽圆环或方块时触发）
  const onColorChange = useCallback((color: ColorFormatsObject) => {
    const hex = color.hex.toUpperCase();
    setSelectedColor(hex);
    setHexInput(hex); // 实时更新输入框
    setHexError('');
  }, []);

  // 输入框提交逻辑
  const handleInputSubmit = useCallback(() => {
    let input = hexInput.trim();
    if (!input.startsWith('#')) input = '#' + input;
    input = input.toUpperCase();

    if (isValidHex(input)) {
      setSelectedColor(input);
      setHexInput(input);
      setHexError('');
      pickerRef.current?.setColor(input);
      Keyboard.dismiss();
    } else {
      setHexError('无效的色号');
    }
  }, [hexInput]);

  const handleInputChange = useCallback((text: string) => {
    const clean = text.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
    const next = '#' + clean;
    setHexInput(next);

    // 输入达到 3 或 6 位时尝试立即应用
    if (clean.length === 3 || clean.length === 6) {
      if (isValidHex(next)) {
        setSelectedColor(next);
        setHexError('');
        pickerRef.current?.setColor(next);
        return;
      }
    }
    if (hexError) setHexError('');
  }, [hexError]);

  const handleSave = async () => {
    if (saving) return;
    setActionError('');
    setSaving(true);
    try {
      await setAccentColor(selectedColor);
      onDismiss();
    } catch (error) {
      setActionError((error as Error)?.message ?? '主题色保存失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (saving) return;
    setActionError('');
    setSaving(true);
    try {
      await resetAccentColor();
      onDismiss();
    } catch (error) {
      setActionError((error as Error)?.message ?? '恢复默认主题失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={saving ? undefined : onDismiss}>
          <Animated.View
            style={[
              styles.backdrop,
              {
                backgroundColor: theme.colors.scrim,
                opacity: opacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.12] }),
              },
            ]}
          />
        </Pressable>
        <Animated.View
          style={[
            styles.modalContainer,
            { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow },
            { opacity, transform: [{ scale }] },
          ]}
          pointerEvents={visible ? 'auto' : 'none'}
        >
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={styles.modalScrollContent} keyboardShouldPersistTaps="handled">
            {/* 标题栏 */}
            <View style={styles.header}>
              <Text variant="titleMedium" style={{ fontWeight: 'bold' }}>选择主题色</Text>
              <IconButton icon="close" size={20} onPress={onDismiss} disabled={saving} />
            </View>

            {/* 核心选色器区域 */}
            <View style={styles.pickerWrapper}>
              <ColorPicker
                ref={pickerRef}
                value={selectedColor}
                onChangeJS={onColorChange}
                style={styles.pickerRoot}
              >
                {/* 
                   1. 外层：色相环 
                   sliderThickness: 圆环的粗细
                   thumbShape: 手柄形状
                */}
                <HueCircular 
                  style={styles.hueRing}
                  containerStyle={styles.hueInner}
                  sliderThickness={25}
                  thumbShape="ring" 
                  thumbSize={24}
                  thumbColor="#fff"
                >
                  {/* 
                     2. 内层：正方形饱和度/亮度面板
                     这个 View 负责让 Panel 居中并保持一定距离
                  */}
                  <View style={styles.panelCenterWrapper}>
                    <Panel1 style={styles.squarePanel} />
                  </View>
                </HueCircular>
              </ColorPicker>
            </View>

            {/* 输入框区域 */}
            <View style={styles.inputSection}>
              <View style={[styles.previewCircle, { backgroundColor: selectedColor }]} />
              
              <View style={[styles.inputContainer, { backgroundColor: theme.colors.surfaceVariant }]}>
                <Text style={[styles.hashTag, { color: theme.colors.onSurfaceVariant }]}>#</Text>
                <TextInput
                  value={hexInput.replace('#', '')}
                  onChangeText={handleInputChange}
                  onBlur={handleInputSubmit}
                  onSubmitEditing={handleInputSubmit}
                  maxLength={6}
                  placeholder="RRGGBB"
                  placeholderTextColor={theme.colors.onSurfaceDisabled}
                  style={[styles.nativeInput, { color: theme.colors.onSurface }]}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {hexError ? (
              <Text style={{ color: theme.colors.error, fontSize: 12, marginLeft: 56, marginTop: 4 }}>
                {hexError}
              </Text>
            ) : null}
            {actionError ? (
              <Text style={{ color: theme.colors.error, fontSize: 12, marginTop: 8 }}>
                {actionError}
              </Text>
            ) : null}

            {/* 底部按钮 */}
            <View style={styles.footer}>
              <Button mode="text" onPress={handleReset} textColor={theme.colors.onSurfaceVariant} disabled={saving}>
                恢复默认
              </Button>
              <Button mode="contained" onPress={handleSave} loading={saving} disabled={saving}>
                确认修改
              </Button>
            </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 500,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 8,
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  modalScrollContent: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
  },
  
  // --- 选色器样式 ---
  pickerWrapper: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerRoot: {
    width: 280,  // 整体宽度
    height: 280, // 整体高度
    alignItems: 'center',
    justifyContent: 'center',
  },
  hueRing: {
    width: '100%',
    height: '100%',
    // 这里的 justify/align 确保了内部的 Panel 居中
    justifyContent: 'center', 
    alignItems: 'center',
  },
  hueInner: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  panelCenterWrapper: {
    // 这个容器的大小决定了正方形离圆环的距离 (留白)
    // 圆环直径 280，厚度 25*2=50，内径 230。
    // 正方形对角线不能超过 230。
    // 设为 140x140 比较安全美观
    width: 150, 
    height: 150,
    borderRadius: 12, // 给容器圆角，配合 hidden
    overflow: 'hidden',
    elevation: 4, // 阴影增加层次感
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    backgroundColor: 'white', // 兜底背景
  },
  squarePanel: {
    width: '100%',
    height: '100%',
    borderRadius: 12, // 面板本身的圆角
  },

  // --- 输入框样式 (复用上一版的现代化设计) ---
  inputSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 16,
  },
  previewCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  inputContainer: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
  },
  hashTag: {
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 4,
  },
  nativeInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
    height: '100%',
    fontWeight: '500',
    letterSpacing: 1,
  },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 24,
  },
});
