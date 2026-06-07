import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type WaterfallSettings = {
  minHeight: number;
  maxHeight: number;
  setMinHeight: (v: number) => void;
  setMaxHeight: (v: number) => void;
};

const DEFAULTS = {
  minHeight: 80,
  maxHeight: 220,
};

const KEY_MIN = 'waterfall:minHeight';
const KEY_MAX = 'waterfall:maxHeight';

const Ctx = createContext<WaterfallSettings | undefined>(undefined);

export const WaterfallSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [minHeight, setMinHeightState] = useState<number>(DEFAULTS.minHeight);
  const [maxHeight, setMaxHeightState] = useState<number>(DEFAULTS.maxHeight);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [minRaw, maxRaw] = await Promise.all([AsyncStorage.getItem(KEY_MIN), AsyncStorage.getItem(KEY_MAX)]);
        const min = minRaw ? Number(minRaw) : DEFAULTS.minHeight;
        const max = maxRaw ? Number(maxRaw) : DEFAULTS.maxHeight;
        // basic sanity
        const clampedMin = Math.max(40, Math.min(min, Math.max(50, max - 10)));
        const clampedMax = Math.max(clampedMin + 10, Math.min(600, max));
        setMinHeightState(clampedMin);
        setMaxHeightState(clampedMax);
      } catch {}
      setHydrated(true);
    })();
  }, []);

  const setMinHeight = (v: number) => {
    const next = Math.max(40, Math.min(v, maxHeight - 10));
    setMinHeightState(next);
    AsyncStorage.setItem(KEY_MIN, String(next)).catch(() => {});
  };

  const setMaxHeight = (v: number) => {
    const next = Math.max(minHeight + 10, Math.min(600, v));
    setMaxHeightState(next);
    AsyncStorage.setItem(KEY_MAX, String(next)).catch(() => {});
  };

  const value = useMemo<WaterfallSettings>(() => ({ minHeight, maxHeight, setMinHeight, setMaxHeight }), [minHeight, maxHeight]);

  if (!hydrated) return <></>;

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useWaterfallSettings(): WaterfallSettings {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useWaterfallSettings must be used within WaterfallSettingsProvider');
  return ctx;
}
