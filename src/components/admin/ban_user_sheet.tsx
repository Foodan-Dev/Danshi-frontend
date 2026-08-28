import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Button, HelperText, RadioButton, Text, TextInput, useTheme } from 'react-native-paper';

import { BottomSheet } from '@/src/components/overlays/bottom_sheet';
import type { AdminUserStatusInput } from '@/src/repositories/admin_repository';

const BAN_REASON_MAX_LENGTH = 200;

const TIMED_BAN_OPTIONS = {
  '1-hour': { label: '1 小时', milliseconds: 60 * 60 * 1000 },
  '1-day': { label: '1 天', milliseconds: 24 * 60 * 60 * 1000 },
  '7-days': { label: '7 天', milliseconds: 7 * 24 * 60 * 60 * 1000 },
  '30-days': { label: '30 天', milliseconds: 30 * 24 * 60 * 60 * 1000 },
} as const;

type TimedBanDuration = keyof typeof TIMED_BAN_OPTIONS;
type BanDuration = TimedBanDuration | 'permanent';

type BanUserSheetProps = {
  visible: boolean;
  userName?: string | null;
  onClose: () => void;
  onSubmit: (input: AdminUserStatusInput) => Promise<void>;
};

const countCharacters = (value: string) => Array.from(value).length;

const formatDateTime = (value: Date) => {
  const year = value.getFullYear();
  const month = value.getMonth() + 1;
  const day = value.getDate();
  const hours = String(value.getHours()).padStart(2, '0');
  const minutes = String(value.getMinutes()).padStart(2, '0');
  return `${year}/${month}/${day} ${hours}:${minutes}`;
};

export function BanUserSheet({ visible, userName, onClose, onSubmit }: BanUserSheetProps) {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState<BanDuration | null>(null);
  const [durationSelectedAt, setDurationSelectedAt] = useState(0);
  const [reasonError, setReasonError] = useState('');
  const [durationError, setDurationError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setReason('');
    setDuration(null);
    setDurationSelectedAt(0);
    setReasonError('');
    setDurationError('');
    setSubmitError('');
    setSubmitting(false);
  }, [visible]);

  const characterCount = countCharacters(reason);
  const selectedExpiry = useMemo(() => {
    if (!duration || duration === 'permanent' || !durationSelectedAt) return null;
    return new Date(durationSelectedAt + TIMED_BAN_OPTIONS[duration].milliseconds);
  }, [duration, durationSelectedAt]);

  const handleReasonChange = (value: string) => {
    setReason(Array.from(value).slice(0, BAN_REASON_MAX_LENGTH).join(''));
    setReasonError('');
    setSubmitError('');
  };

  const handleDurationChange = (value: string) => {
    if (value !== 'permanent' && !(value in TIMED_BAN_OPTIONS)) return;
    setDuration(value as BanDuration);
    setDurationSelectedAt(Date.now());
    setDurationError('');
    setSubmitError('');
  };

  const handleSubmit = async () => {
    const trimmedReason = reason.trim();
    const nextReasonError = trimmedReason ? '' : '请输入封禁理由，不能只填写空格';
    const nextDurationError = duration ? '' : '请选择一个封禁时长或永久封禁';
    setReasonError(nextReasonError);
    setDurationError(nextDurationError);
    setSubmitError('');
    if (nextReasonError || nextDurationError || !duration) return;

    const input: AdminUserStatusInput = duration === 'permanent'
      ? { ban_reason: trimmedReason, ban_is_permanent: true }
      : {
          ban_reason: trimmedReason,
          ban_is_permanent: false,
          banned_until: new Date(
            durationSelectedAt + TIMED_BAN_OPTIONS[duration].milliseconds,
          ).toISOString(),
        };

    setSubmitting(true);
    try {
      await onSubmit(input);
      onClose();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '封禁失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = userName?.trim() || '该用户';

  return (
    <BottomSheet
      visible={visible}
      onClose={submitting ? () => undefined : onClose}
      height={Math.min(windowHeight * 0.9, 620)}
    >
      <View style={styles.container}>
        <Text variant="titleLarge" style={styles.title}>封禁用户</Text>
        <Text style={{ color: theme.colors.onSurfaceVariant }}>
          正在封禁“{displayName}”。封禁理由会展示给被封用户，请填写清楚、完整且便于理解的说明。
        </Text>

        <TextInput
          label="封禁理由 *"
          value={reason}
          onChangeText={handleReasonChange}
          mode="outlined"
          multiline
          numberOfLines={4}
          maxLength={BAN_REASON_MAX_LENGTH}
          error={Boolean(reasonError)}
          disabled={submitting}
          placeholder="例如：多次发布违规内容，已根据社区规则处理"
          right={<TextInput.Affix text={`${characterCount}/${BAN_REASON_MAX_LENGTH}`} />}
          style={styles.reasonInput}
        />
        <HelperText type="error" visible={Boolean(reasonError)} padding="none">
          {reasonError}
        </HelperText>

        <Text variant="titleSmall" style={styles.durationTitle}>封禁时长 *</Text>
        <ScrollView style={styles.durationList} showsVerticalScrollIndicator={false}>
          <RadioButton.Group onValueChange={handleDurationChange} value={duration ?? ''}>
            {Object.entries(TIMED_BAN_OPTIONS).map(([value, option]) => (
              <RadioButton.Item
                key={value}
                label={option.label}
                value={value}
                disabled={submitting}
                position="leading"
                style={styles.radioItem}
              />
            ))}
            <RadioButton.Item
              label="永久封禁"
              value="permanent"
              disabled={submitting}
              position="leading"
              style={styles.radioItem}
            />
          </RadioButton.Group>
        </ScrollView>
        {selectedExpiry ? (
          <Text style={[styles.expiryHint, { color: theme.colors.onSurfaceVariant }]}>
            预计解封时间：{formatDateTime(selectedExpiry)}
          </Text>
        ) : null}
        <HelperText type="error" visible={Boolean(durationError)} padding="none">
          {durationError}
        </HelperText>
        <HelperText type="error" visible={Boolean(submitError)} padding="none">
          {submitError}
        </HelperText>

        <View style={styles.actions}>
          <Button mode="text" onPress={onClose} disabled={submitting}>取消</Button>
          <Button
            mode="contained"
            buttonColor={theme.colors.error}
            textColor={theme.colors.onError}
            loading={submitting}
            disabled={submitting}
            onPress={() => void handleSubmit()}
          >
            确认封禁
          </Button>
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  title: {
    fontWeight: '700',
    marginBottom: 6,
  },
  reasonInput: {
    marginTop: 16,
    minHeight: 112,
  },
  durationTitle: {
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 2,
  },
  durationList: {
    flexShrink: 1,
  },
  radioItem: {
    minHeight: 44,
    paddingHorizontal: 0,
  },
  expiryHint: {
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
  },
});
