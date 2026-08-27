import React, { useMemo, useState } from 'react';
import { Clipboard, Platform, StyleSheet, View } from 'react-native';
import { Button, List, Text, useTheme } from 'react-native-paper';

import {
  formatAppDiagnostics,
  getAppDiagnostics,
} from '@/src/lib/diagnostics/app_diagnostics';

async function copyText(text: string): Promise<void> {
  if (Platform.OS !== 'web') {
    Clipboard.setString(text);
    return;
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // 非安全上下文或权限拒绝时继续使用 DOM 复制回退。
    }
  }

  if (typeof document === 'undefined') {
    throw new Error('当前环境不支持复制');
  }

  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.setAttribute('readonly', '');
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textArea);

  if (!copied) {
    throw new Error('当前浏览器不支持复制');
  }
}

export function AppDiagnosticsSection() {
  const theme = useTheme();
  const entries = useMemo(() => getAppDiagnostics(), []);
  const diagnosticText = useMemo(() => formatAppDiagnostics(entries), [entries]);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  const handleCopy = async () => {
    try {
      await copyText(diagnosticText);
      setCopyStatus('copied');
    } catch (error) {
      if (__DEV__) console.warn('[Settings] Copy diagnostics failed:', error);
      setCopyStatus('failed');
    }
  };

  return (
    <List.Section style={styles.section}>
      <List.Subheader style={styles.subheader}>运行诊断</List.Subheader>
      <View
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surfaceVariant,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        {entries.map(({ label, value }, index) => (
          <View
            key={label}
            style={[
              styles.row,
              index > 0 && {
                borderTopColor: theme.colors.outlineVariant,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Text style={[styles.label, { color: theme.colors.onSurfaceVariant }]}>{label}</Text>
            <Text selectable style={[styles.value, { color: theme.colors.onSurface }]}>
              {value}
            </Text>
          </View>
        ))}
        <Button
          mode="contained-tonal"
          icon={copyStatus === 'copied' ? 'check' : 'content-copy'}
          onPress={() => {
            void handleCopy();
          }}
          style={styles.copyButton}
        >
          {copyStatus === 'copied'
            ? '已复制诊断信息'
            : copyStatus === 'failed'
              ? '复制失败，请重试'
              : '复制诊断信息'}
        </Button>
      </View>
    </List.Section>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: -16,
  },
  subheader: {
    paddingHorizontal: 16,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    paddingBottom: 12,
  },
  row: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  value: {
    fontSize: 14,
    lineHeight: 20,
  },
  copyButton: {
    marginHorizontal: 12,
    marginTop: 8,
  },
});
