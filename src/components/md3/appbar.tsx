import React from 'react'
import { Appbar } from 'react-native-paper'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '@/src/constants/theme'
import { useTheme as useAppTheme } from '@/src/context/theme_context'

export type AppbarHeaderProps = React.ComponentProps<typeof Appbar.Header> & {
  title?: string
  onBack?: () => void
  center?: boolean
  elevation?: number
}

export const AppbarHeader: React.FC<AppbarHeaderProps> = ({
  title,
  onBack,
  center = true,
  elevation = 0,
  children,
  ...rest
}) => {
  const insets = useSafeAreaInsets()
  const { effective } = useAppTheme()
  const c = Colors[effective]
  const bg = c.header
  const on = c.text

  return (
    <Appbar.Header
      statusBarHeight={insets.top}
      mode={center ? 'center-aligned' : 'small'}
      theme={{ colors: { surface: bg, onSurface: on } }}
      style={{ elevation }}
      {...rest}
    >
      {onBack ? <Appbar.BackAction onPress={onBack} /> : null}
      {title ? <Appbar.Content title={title} titleStyle={{ color: on as string }} /> : null}
      {children}
    </Appbar.Header>
  )
}

export default AppbarHeader
