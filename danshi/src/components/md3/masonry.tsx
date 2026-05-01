import React, { useMemo } from 'react'
import { View, ViewProps } from 'react-native'
import { useResponsive } from '@/src/hooks/use_responsive'

export type Breakpoint = 'base' | 'sm' | 'md' | 'lg' | 'xl'
export type ColumnsConfig = number | Partial<Record<Breakpoint, number>>

export type MasonryProps<T> = ViewProps & {
  data: T[]
  columns?: ColumnsConfig
  gap?: number
  verticalGap?: number
  renderItem: (item: T, index: number) => React.ReactNode
  getItemHeight: (item: T, index: number) => number
  keyExtractor?: (item: T, index: number) => string
}

function normalizePositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.floor(value))
}

function normalizeNonNegativeNumber(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback
  return Math.max(0, value)
}

function pickColumns(columns: ColumnsConfig | undefined, current: Breakpoint): number {
  if (!columns) return 2
  if (typeof columns === 'number') return normalizePositiveInt(columns, 2)
  const conf = columns as Partial<Record<Breakpoint, number>>
  const order: Breakpoint[] =
    current === 'xl' ? ['xl', 'lg', 'md', 'sm', 'base']
    : current === 'lg' ? ['lg', 'md', 'sm', 'base']
    : current === 'md' ? ['md', 'sm', 'base']
    : current === 'sm' ? ['sm', 'base']
    : ['base']
  for (const k of order) {
    const val = conf[k as Breakpoint]
    if (typeof val === 'number') return normalizePositiveInt(val, 2)
  }
  return 2
}

export function Masonry<T>({
  data,
  columns: columnsConfig = 2,
  gap = 12,
  verticalGap,
  renderItem,
  getItemHeight,
  keyExtractor,
  style,
  ...rest
}: MasonryProps<T>) {
  const { current } = useResponsive()
  const columns = pickColumns(columnsConfig, current as Breakpoint)
  const normalizedGap = normalizeNonNegativeNumber(gap, 12)
  const itemGap =
    typeof verticalGap === 'number'
      ? normalizeNonNegativeNumber(verticalGap, normalizedGap)
      : normalizedGap

  const distributed = useMemo(() => {
    const colItems: { items: { item: T; index: number }[]; height: number }[] = Array.from(
      { length: columns },
      () => ({ items: [], height: 0 })
    )
    data.forEach((item, index) => {
      let minIdx = 0
      for (let i = 1; i < columns; i++) {
        if (colItems[i].height < colItems[minIdx].height) minIdx = i
      }
      const h = normalizeNonNegativeNumber(getItemHeight(item, index), 0)
      colItems[minIdx].items.push({ item, index })
      colItems[minIdx].height += (colItems[minIdx].items.length === 1 ? 0 : itemGap) + h
    })
    return colItems.map(c => c.items)
  }, [data, columns, getItemHeight, itemGap])

  return (
    <View
      style={[
        { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'nowrap', marginLeft: -normalizedGap },
        // @ts-ignore web supports gap, native will ignore
        { gap: normalizedGap },
        style,
      ]}
      {...rest}
    >
      {distributed.map((col, colIdx) => (
        <View key={`col-${colIdx}`} style={{ flex: 1, paddingLeft: normalizedGap }}>
          {col.map(({ item, index }, i) => (
            <View
              key={keyExtractor ? keyExtractor(item, index) : `${colIdx}-${index}`}
              style={{ marginTop: i === 0 ? 0 : itemGap }}
            >
              {renderItem(item, index)}
            </View>
          ))}
        </View>
      ))}
    </View>
  )
}

export default Masonry
