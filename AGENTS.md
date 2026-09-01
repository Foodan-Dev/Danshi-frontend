# AGENTS.md

本文件是本仓库对 AI 编码代理与人类贡献者的共同约定。

## 发布与热更新

本项目用 EAS Update 做热更新，`app.json` 里 `runtimeVersion` 采用 `fingerprint` 策略：
EAS 会对项目算一个 native 指纹，**只有指纹相同的构建才能收到对应的 OTA**。

### 改 `package.json` 的 `scripts` 会切断既有构建的热更新通道

`scripts` 块参与指纹计算。新增一个纯工具链脚本（`test`、`format`、任何东西）
就会改变指纹，**此后发布的所有 OTA 都不会送达已经安装的构建**。

这个后果与改动本身毫无直觉关联，而且**没有任何报错**：

- `eas update` 照常报告 `✔ Published!`，并返回新的 update ID；
- 服务端确实存在这个新版本；
- 只是没有任何设备能收到它——已安装的 App 会一直停在指纹变更前的最后一版。

只有主动拉 manifest 才会发现：

```bash
curl -s "https://u.expo.dev/<projectId>" \
  -H "expo-platform: ios" \
  -H "expo-runtime-version: <设备上的 runtime>" \
  -H "expo-channel-name: testflight" \
  -H "expo-protocol-version: 1" -H "accept: multipart/mixed" \
  | grep -oE '"id":"[a-f0-9-]{36}"'
```

设备上的 runtime 可以在 App 的「设置 → 关于旦食」诊断页看到。

2026-08-31 就发生过一次：一个与原生无关的错误码重构顺手加了一行 `test` 脚本，
此后三批改动的 OTA 全部无法送达 TestFlight build 14，只能重出原生包（0.7.1 / build 15）。

### 排查指纹变化要用 EAS，不要用本地工具

本地 `npx expo-updates fingerprint:generate` 算出的值与 EAS 实际使用的**不一致**
（输入口径不同），拿它做对照实验会得出错误结论。上述事故中，本地实验一度
「排除」了真正的原因。

要定位差异，用 EAS 自己的比较命令，它会直接指出是哪个文件的哪一段变了：

```bash
eas fingerprint:compare --update-id <旧更新ID> --update-id <新更新ID>
```

也支持 `--build-id`，以及不带参数比较当前工作区与最近一次构建。

### 发版前的检查

改动如果碰了 `package.json`、`app.json`、`eas.json`、依赖或原生目录，
在推 OTA 之前先确认指纹没变；变了就要重出原生包，光推 OTA 是无效的。

## 版本号

App 展示的版本取自 `app.json` 的 `expo.version`；`package.json` 的 `version`
与它无关且长期不同步，改版本号时以 `app.json` 为准。
构建号由 `eas.json` 各 profile 的 `autoIncrement` 自动递增，不要手工改。
