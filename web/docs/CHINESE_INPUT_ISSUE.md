# VibeTunnel 中文输入乱码问题 - Claude Code 修复指令

## 问题背景

VibeTunnel 是一个允许通过 Web 浏览器访问终端会话的 macOS 应用。当前存在一个严重的中文输入问题：

### 症状
- 在终端中输入中文字符后，显示为乱码，如 `0<008b>0<0095>0<008b>0<0095>`
- 问题出现在所有环境：Safari 浏览器、iPad、Chrome 等

### 已确认的工作部分
1. **前端 IME 输入组件正常**：
   - 位置：`web/src/client/components/ime-input.ts`
   - 可以正确捕获中文输入
   - 日志显示：`IME composition ended: "测试"`

2. **客户端到服务器传输正常**：
   - 位置：`web/src/client/components/session-view/input-manager.ts`
   - 正确识别中文：`hasChineseChars: true`
   - 字符编码正确：`charCodes: ["6d4b", "8bd5"]`（"测试"的 Unicode）
   - WebSocket 传输成功

3. **服务器接收正常**：
   - 位置：`web/src/server/routes/sessions.ts:1050-1053`
   - 日志显示：`Writing Chinese text to PTY (HTTP): "中文", bytes: e4b8ade69687`
   - UTF-8 编码正确

## 问题诊断

### 根本原因
问题出在 **PTY（伪终端）进程的字符编码设置**。虽然代码尝试设置 UTF-8 环境变量，但实际没有正确传递给 PTY 进程。

### 关键日志分析
```
2025-09-10T07:17:16.568Z DEBUG [[SRV] pty-manager] Forcing UTF-8 encoding: LANG=en_US.UTF-8
2025-09-10T07:17:16.568Z DEBUG [[SRV] pty-manager] Setting LC_CTYPE=en_US.UTF-8 for character handling
    "encoding": {
      "LANG": "not set",
      "LC_CTYPE": "not set",
      "LC_ALL": "not set"
```

虽然代码设置了 UTF-8，但实际传递给 PTY 时可能丢失了。

## 需要修复的代码

### 1. PTY 环境变量传递问题
**文件**: `web/src/server/pty/pty-manager.ts`

**当前代码**（第 404-409 行）：
```typescript
const ptyEnv = {
  ...process.env,
  TERM: term,
  VIBETUNNEL_SESSION_ID: sessionId,
};
```

**问题**：`getEnvironmentVars()` 方法设置的 UTF-8 环境变量没有被使用。

**修复方案**：
```typescript
// 先获取包含 UTF-8 设置的环境变量
const baseEnv = this.getEnvironmentVars(term);
const ptyEnv = {
  ...process.env,
  ...baseEnv,  // 合并 UTF-8 设置
  VIBETUNNEL_SESSION_ID: sessionId,
};
```

### 2. 环境变量设置位置
**文件**: `web/src/server/pty/pty-manager.ts:1927-1944`

当前代码已经有 UTF-8 设置逻辑，但需要确保被调用：
```typescript
// Force UTF-8 encoding if not already set
if (!envVars.LANG || !envVars.LANG.includes('UTF-8')) {
  const systemLang = envVars.LANG?.split('.')[0] || 'en_US';
  envVars.LANG = `${systemLang}.UTF-8`;
}
if (!envVars.LC_CTYPE) {
  envVars.LC_CTYPE = envVars.LANG;
}
```

## 修复步骤

1. **修改 PTY 创建代码**：
   - 确保 `getEnvironmentVars()` 的返回值被正确使用
   - 在 spawn PTY 时传递包含 UTF-8 设置的环境变量

2. **验证环境变量传递**：
   - 在 PTY 创建后立即执行 `echo $LANG` 验证
   - 检查日志确认环境变量正确设置

3. **测试**：
   - 重启服务器
   - 创建新会话
   - 输入 `locale` 检查编码设置
   - 输入 `echo "你好世界"` 测试中文

## 临时解决方案

如果修复后仍有问题，可以在每个新会话中手动设置：
```bash
export LANG=zh_CN.UTF-8
export LC_ALL=zh_CN.UTF-8
export LC_CTYPE=zh_CN.UTF-8
```

## 相关文件清单

1. **前端 IME 输入**：
   - `web/src/client/components/ime-input.ts` - IME 输入组件
   - `web/src/client/components/session-view/input-manager.ts` - 输入管理器

2. **服务器端处理**：
   - `web/src/server/pty/pty-manager.ts` - PTY 进程管理（**需要修复**）
   - `web/src/server/routes/sessions.ts` - 会话路由处理

3. **日志文件**：
   - `/Users/m1maxmbp/.vibetunnel/log.txt` - 服务器日志

## 调试命令

```bash
# 查看服务器日志
tail -f /Users/m1maxmbp/.vibetunnel/log.txt | grep -E "Chinese|UTF|LANG|LC_"

# 检查当前环境变量
echo $LANG
locale

# 测试中文输入
echo "测试中文"
```

## 预期结果

修复后，中文输入应该：
1. 在终端中正常显示中文字符
2. 不再出现 `0<008b>0<0095>` 这样的乱码
3. 支持所有中文字符和标点符号

## 注意事项

- 修改后需要重启 VibeTunnel 服务器
- 可能需要创建新的会话才能生效
- 确保 macOS 系统本身支持 UTF-8（通常默认支持）