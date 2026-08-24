import React, { createContext, useContext, useEffect, useState } from 'react'
import { StyleSheet, View, useColorScheme as useRNColorScheme } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { MD3DarkTheme, MD3LightTheme, useTheme as usePaperTheme } from 'react-native-paper'
import { isValidHex } from '@/src/lib/theme/color_generator'
import type { ExtendedMD3Theme } from '@/src/constants/md3_theme'

// Types
export type ThemeMode = 'light' | 'dark' | 'system'
export type ThemeColors = ExtendedMD3Theme['colors']

// 空字符串表示使用默认预设颜色
const DEFAULT_ACCENT_COLOR = ''

type ThemeContextValue = {
  mode: ThemeMode
  effective: 'light' | 'dark'
  accentColor: string  // 空字符串表示使用默认
  setAccentColor: (color: string) => Promise<void>
  resetAccentColor: () => Promise<void>  // 重置为默认
  setMode: (m: ThemeMode) => Promise<void>
  toggle: () => Promise<void>
}

const MODE_KEY = 'appThemeMode'
const ACCENT_KEY = 'appAccentColor'

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function useSystemColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false)
  useEffect(() => setHasHydrated(true), [])
  const cs = useRNColorScheme()
  if (hasHydrated) return cs
  return 'light'
}

export const ThemeModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const system = useSystemColorScheme() ?? 'light'
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [accentColor, setAccentColorState] = useState<string>(DEFAULT_ACCENT_COLOR)
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const [modeRaw, accentRaw] = await Promise.all([
          AsyncStorage.getItem(MODE_KEY),
          AsyncStorage.getItem(ACCENT_KEY),
        ])
        if (modeRaw === 'light' || modeRaw === 'dark' || modeRaw === 'system') {
          setModeState(modeRaw)
        }
        if (accentRaw && isValidHex(accentRaw)) {
          setAccentColorState(accentRaw)
        }
        // 如果没有保存过自定义颜色，保持默认空字符串
      } catch {
        // ignore
      }
      setIsReady(true)
    }
    load()
  }, [])

  const setMode = async (m: ThemeMode) => {
    try {
      await AsyncStorage.setItem(MODE_KEY, m)
    } catch {
      // ignore
    }
    setModeState(m)
  }

  const setAccentColor = async (color: string) => {
    if (!isValidHex(color)) return
    try {
      await AsyncStorage.setItem(ACCENT_KEY, color)
    } catch {
      // ignore
    }
    setAccentColorState(color)
  }

  const resetAccentColor = async () => {
    try {
      await AsyncStorage.removeItem(ACCENT_KEY)
    } catch {
      // ignore
    }
    setAccentColorState('')
  }

  const toggle = async () => {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark'
    await setMode(next)
  }

  const effective = mode === 'system' ? (system === 'dark' ? 'dark' : 'light') : mode

  if (!isReady) {
    const bg = effective === 'dark' ? MD3DarkTheme.colors.background : MD3LightTheme.colors.background
    return <View style={[StyleSheet.absoluteFill, { backgroundColor: bg }]} />
  }

  return (
    <ThemeContext.Provider value={{ mode, effective, accentColor, setMode, setAccentColor, resetAccentColor, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')

  const paper = usePaperTheme<ExtendedMD3Theme>()
  const colors: ThemeColors = paper.colors

  return {
    colors,
    text: colors.onSurface,
    tint: colors.primary,
    card: colors.surface,
    danger: colors.error,
    icon: colors.secondary,
    background: colors.background,
    tabIconDefault: colors.outline,
    mode: ctx.mode,
    effective: ctx.effective,
    accentColor: ctx.accentColor,
    setMode: ctx.setMode,
    setAccentColor: ctx.setAccentColor,
    resetAccentColor: ctx.resetAccentColor,
    toggle: ctx.toggle,
  }
}

export default useTheme
