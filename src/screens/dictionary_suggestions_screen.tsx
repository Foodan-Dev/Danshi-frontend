import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Appbar,
  Button,
  Card,
  Chip,
  SegmentedButtons,
  Text,
  TextInput,
  useTheme,
} from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppError } from '@/src/lib/errors/app_error';
import {
  dictionarySuggestionsService,
  type DictionarySuggestion,
  type FlavorStance,
  type SuggestionKind,
  type SuggestionStatus,
} from '@/src/services/dictionary_suggestions_service';
import { formatDate } from '@/src/utils/time_format';

const KIND_OPTIONS: { value: SuggestionKind; label: string }[] = [
  { value: 'flavor', label: '口味' },
  { value: 'cuisine', label: '菜系' },
  { value: 'canteen', label: '食堂' },
  { value: 'canteen_window', label: '窗口' },
];
const STANCE_OPTIONS: { value: FlavorStance; label: string }[] = [
  { value: 'has', label: '食物特征' },
  { value: 'prefer', label: '偏好' },
  { value: 'avoid', label: '忌口' },
];
const STATUS_LABEL: Record<SuggestionStatus, string> = {
  pending: '审核中',
  approved: '已通过',
  rejected: '未通过',
};

const isKind = (value: string): value is SuggestionKind =>
  value === 'flavor' || value === 'cuisine' || value === 'canteen' || value === 'canteen_window';
const isStance = (value: string): value is FlavorStance =>
  value === 'has' || value === 'prefer' || value === 'avoid';

export default function DictionarySuggestionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [suggestions, setSuggestions] = useState<DictionarySuggestion[]>([]);
  const [kind, setKind] = useState<SuggestionKind>('flavor');
  const [stance, setStance] = useState<FlavorStance>('has');
  const [name, setName] = useState('');
  const [parentCanteenId, setParentCanteenId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await dictionarySuggestionsService.mine();
      setSuggestions(result.suggestions);
    } catch (caught: unknown) {
      setError(AppError.from(caught, '读取建议失败').message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approvedCanteens = useMemo(
    () => suggestions.filter(
      (item) => item.kind === 'canteen' && item.status === 'approved' && item.resultingCanteenId !== null,
    ),
    [suggestions],
  );

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const created = await dictionarySuggestionsService.create({
        kind,
        proposedName: name,
        flavorStance: kind === 'flavor' ? stance : undefined,
        parentCanteenId: kind === 'canteen_window' ? parentCanteenId ?? undefined : undefined,
      });
      setSuggestions((current) => [created, ...current.filter((item) => item.id !== created.id)]);
      setName('');
      setSuccess('建议已提交，审核结果会显示在下方。');
    } catch (caught: unknown) {
      setError(AppError.from(caught, '提交建议失败').message);
    } finally {
      setSubmitting(false);
    }
  }, [kind, name, parentCanteenId, stance]);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <Appbar.Header statusBarHeight={insets.top}>
        <Appbar.BackAction onPress={() => router.back()} />
        <Appbar.Content title="词条建议" />
      </Appbar.Header>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void load(true)}
            colors={[theme.colors.primary]}
            tintColor={theme.colors.primary}
          />
        }
      >
        <Card mode="contained">
          <Card.Content style={styles.form}>
            <Text variant="titleMedium">提交新词条</Text>
            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
              提交后会进入审核，不会立即出现在发帖选项中。
            </Text>
            <SegmentedButtons
              value={kind}
              onValueChange={(value) => {
                if (isKind(value)) {
                  setKind(value);
                  setSuccess(null);
                }
              }}
              buttons={KIND_OPTIONS}
            />
            <TextInput
              mode="outlined"
              label={`${KIND_OPTIONS.find((item) => item.value === kind)?.label ?? '词条'}名称`}
              value={name}
              maxLength={50}
              onChangeText={setName}
              right={<TextInput.Affix text={`${name.length}/50`} />}
            />
            {kind === 'flavor' ? (
              <View style={styles.fieldGroup}>
                <Text variant="labelLarge">口味用途</Text>
                <View style={styles.chips}>
                  {STANCE_OPTIONS.map((option) => (
                    <Chip
                      key={option.value}
                      selected={stance === option.value}
                      onPress={() => {
                        if (isStance(option.value)) setStance(option.value);
                      }}
                    >
                      {option.label}
                    </Chip>
                  ))}
                </View>
              </View>
            ) : null}
            {kind === 'canteen_window' ? (
              <View style={styles.fieldGroup}>
                <Text variant="labelLarge">所属食堂</Text>
                {approvedCanteens.length ? (
                  <View style={styles.chips}>
                    {approvedCanteens.map((item) => (
                      <Chip
                        key={item.id}
                        selected={parentCanteenId === item.resultingCanteenId}
                        onPress={() => setParentCanteenId(item.resultingCanteenId)}
                      >
                        {item.proposedName}
                      </Chip>
                    ))}
                  </View>
                ) : (
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    当前接口只提供数字食堂 ID。请先提交食堂建议并等待通过，再为该食堂建议窗口。
                  </Text>
                )}
              </View>
            ) : null}
            {error ? <Text style={{ color: theme.colors.error }}>{error}</Text> : null}
            {success ? <Text style={{ color: theme.colors.primary }}>{success}</Text> : null}
            <Button
              mode="contained"
              loading={submitting}
              disabled={submitting || !name.trim() || (kind === 'canteen_window' && !parentCanteenId)}
              onPress={() => void submit()}
            >
              提交建议
            </Button>
          </Card.Content>
        </Card>

        <View style={styles.sectionHeader}>
          <Text variant="titleMedium">我的建议</Text>
          {!loading ? <Text variant="bodySmall">共 {suggestions.length} 条</Text> : null}
        </View>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" />
            <Text>正在读取审核状态…</Text>
          </View>
        ) : suggestions.length === 0 ? (
          <Card mode="contained">
            <Card.Content style={styles.loading}>
              <Ionicons name="bulb-outline" size={40} color={theme.colors.outline} />
              <Text>还没有提交过建议</Text>
            </Card.Content>
          </Card>
        ) : suggestions.map((item) => (
          <Card key={item.id} mode="contained">
            <Card.Title
              title={item.proposedName}
              subtitle={`${KIND_OPTIONS.find((option) => option.value === item.kind)?.label ?? item.kind} · ${formatDate(item.createdAt, 'full')}`}
              right={() => (
                <Chip
                  compact
                  icon={item.status === 'approved' ? 'check' : item.status === 'rejected' ? 'close' : 'clock-outline'}
                  style={styles.statusChip}
                >
                  {STATUS_LABEL[item.status]}
                </Chip>
              )}
            />
            {item.reviewNote ? (
              <Card.Content>
                <Text variant="bodySmall">审核说明：{item.reviewNote}</Text>
              </Card.Content>
            ) : null}
          </Card>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 16, paddingBottom: 48, gap: 12 },
  form: { gap: 14 },
  fieldGroup: { gap: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  loading: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 32 },
  statusChip: { marginRight: 12 },
});
