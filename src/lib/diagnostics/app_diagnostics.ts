import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

import { API_BASE_URL } from '@/src/constants/app';

export type DiagnosticEntry = {
  label: string;
  value: string;
};

const unavailable = '不可用';

function getBundleSource(): string {
  if (Platform.OS === 'web') {
    return 'Web bundle（不适用内嵌/OTA）';
  }

  if (__DEV__) {
    return '开发 bundle（无法判断内嵌/OTA）';
  }

  if (!Updates.isEnabled && Constants.executionEnvironment === ExecutionEnvironment.StoreClient) {
    return 'Expo Go / 开发客户端（无法判断）';
  }

  if (!Updates.isEnabled) {
    return '内嵌 bundle（expo-updates 未启用）';
  }

  return Updates.isEmbeddedLaunch ? '内嵌 bundle' : 'OTA 更新';
}

function displayString(value: string | null | undefined): string {
  const normalized = value?.trim();
  return normalized || unavailable;
}

function formatUpdateCreatedAt(): string {
  const createdAt = Updates.createdAt;
  if (!createdAt || Number.isNaN(createdAt.getTime())) {
    return unavailable;
  }
  return createdAt.toISOString();
}

function getBuildNumber(): string {
  if (Platform.OS === 'ios') {
    return Constants.platform?.ios?.buildNumber ?? unavailable;
  }

  if (Platform.OS === 'android') {
    const versionCode = Constants.platform?.android?.versionCode;
    return versionCode == null ? unavailable : String(versionCode);
  }

  return unavailable;
}

function getExecutionEnvironment(): string {
  switch (Constants.executionEnvironment) {
    case ExecutionEnvironment.Standalone:
      return '独立构建';
    case ExecutionEnvironment.StoreClient:
      return 'Expo Go / 开发客户端';
    case ExecutionEnvironment.Bare:
      return 'Bare React Native';
    default:
      return unavailable;
  }
}

export function getAppDiagnostics(): DiagnosticEntry[] {
  const runtimeVersion = displayString(
    Updates.runtimeVersion || Constants.expoRuntimeVersion,
  );
  const entries: DiagnosticEntry[] = [
    { label: 'Bundle 来源', value: getBundleSource() },
    {
      label: 'expo-updates',
      value: Platform.OS === 'web' ? '不适用' : Updates.isEnabled ? '已启用' : '未启用',
    },
    { label: '更新 ID', value: displayString(Updates.updateId) },
    { label: '更新创建时间', value: formatUpdateCreatedAt() },
    { label: 'Runtime version', value: runtimeVersion },
    { label: 'Channel', value: displayString(Updates.channel) },
    { label: 'App 版本', value: displayString(Constants.expoConfig?.version) },
    { label: '构建号', value: getBuildNumber() },
    { label: 'API base URL', value: API_BASE_URL },
    { label: '运行环境', value: getExecutionEnvironment() },
    { label: '平台', value: Platform.OS },
    {
      label: '紧急回退启动',
      value: Platform.OS === 'web' ? '不适用' : Updates.isEmergencyLaunch ? '是' : '否',
    },
  ];

  if (Updates.isEmergencyLaunch && Updates.emergencyLaunchReason) {
    entries.push({ label: '紧急回退原因', value: Updates.emergencyLaunchReason });
  }

  return entries;
}

export function formatAppDiagnostics(entries: DiagnosticEntry[]): string {
  return ['旦食 App 诊断信息', ...entries.map(({ label, value }) => `${label}: ${value}`)].join('\n');
}
