<div align="center">

<img src="assets/command-icon.png" alt="Vibelet Search" width="120" height="120" />

# Vibelet Search

[English](./README.md) · **简体中文**

在 Raycast 中按标题或完整对话内容搜索并恢复 Claude Code / Codex 会话 —— 同时覆盖 CLI 和桌面 App。

<img src="assets/screenshot-1.webp" alt="Vibelet Search —— 会话列表" width="720" />
<img src="assets/screenshot-2.webp" alt="Vibelet Search —— 对话详情" width="720" />

</div>

> 本扩展属于 **[Vibelet](https://vibelet.icu)** 工具集 —— 在手机上 AI 编程。访问 **<https://vibelet.icu>** 即可从手机远程驱动 Claude / Codex 编码 Agent（发送 prompt、查看 diff、批准工具调用，全程本地优先）。

在 Raycast 中全局搜索你的 Claude / Codex 会话 —— **同时覆盖 CLI 和桌面 App** —— 按标题或完整对话内容搜索。一键在终端中恢复任意会话，或直接跳转到对应的桌面 App。

🌐 **官网**：<https://vibelet.icu>  ·  仓库：<https://github.com/quanru/raycast-vibelet-search>

## 特性

- **统一搜索四个来源**：
  - 🟠 **Claude Code** CLI (`~/.claude`)
  - 🟣 **Claude Desktop** App (`~/Library/Application Support/Claude/claude-code-sessions`)
  - 🟢 **Codex CLI** (`~/.codex`)
  - 🔵 **Codex Desktop** App（写入 `~/.codex`，`originator = "Codex Desktop"`）
- **标题 + 全文搜索** —— 由 ripgrep 驱动的全文搜索，支持数千条会话规模
- **匹配上下文视图** —— 按内容搜索时，匹配到的消息和上下文会出现在详情视图顶部
- **每条会话带来源标签** —— 列表和详情头部都标注出处
- **支持在 App 中打开或在终端中恢复** —— App 来源的会话默认在桌面 App 中打开，CLI 来源的默认在终端恢复
- **多终端支持** —— Terminal.app、iTerm、Ghostty、WezTerm、Warp
- **聊天式详情视图** —— 用户消息渲染为引用块、助手消息平铺；带时间戳、来源徽章；Claude App 会话还会显示关联的 PR 元数据

## 命令

| 命令 | 描述 |
|---|---|
| **Vibelet Search** | 浏览并搜索所有 Claude Code / Codex 会话 |

### 会话操作

- `↵` 查看对话（按内容搜索时显示匹配上下文）
- `⌘O` 在对应的桌面 App 中打开（Claude.app / Codex.app）
- `⌘T` 在配置的终端中恢复
- `⌘R` 复制恢复命令到剪贴板
- `⌘⇧R` 复制恢复命令并附带各 CLI 的「跳过权限确认」开关
- 在 Finder 中打开项目目录
- 复制 session ID / 项目路径

## 安装

本扩展**尚未上架 Raycast Store**，需要从源码安装。
本节按可被 AI 助手（Claude Code、Codex 等）端到端执行的格式编写，无需进一步输入。

### 前置条件

- macOS（Raycast 仅支持 macOS）
- 已安装 [Raycast](https://raycast.com) 到 `/Applications/Raycast.app`
- Node.js ≥ 20（`node -v`）—— 缺失时执行 `brew install node`
- `git`

### 一行安装（推荐）

```bash
curl -fsSL https://raw.githubusercontent.com/quanru/raycast-vibelet-search/main/install.sh | bash
```

脚本会把仓库 clone 到 `~/.local/share/vibelet-search`，运行 `npm install`、
构建，并打开 Raycast 的「导入扩展」对话框指向该 clone。

### 手动安装

```bash
git clone https://github.com/quanru/raycast-vibelet-search.git ~/.local/share/vibelet-search
cd ~/.local/share/vibelet-search
npm install        # postinstall 会拷贝内置的 ripgrep 二进制
npm run build
open "raycast://extensions/raycast/raycast/import-extension?path=$HOME/.local/share/vibelet-search"
```

然后在 Raycast 内确认导入。

### 更新

因为是 sideload 安装（非 Store 渠道），更新需要**手动**触发 —— 重新跑安装脚本即可：

```bash
bash ~/.local/share/vibelet-search/install.sh
```

脚本会执行 `git fetch && git reset --hard origin/main`，重新构建，
Raycast 自动加载新版本。（扩展上架 Raycast Store 后，Store 用户将自动更新；
sideload 用户仍需重新跑安装脚本或 `git pull && npm run build`。）

### 卸载

```bash
rm -rf ~/.local/share/vibelet-search
```

然后在 Raycast → Extensions 中移除 "Vibelet Search"。

### 给 AI Agent 的 Runbook

当上面的一行安装看起来成功，但 Raycast 中找不到 **Vibelet Search** 命令时
（典型现象：用户报告 `command not found`），按以下步骤操作，无需再问用户。

**1. 探测机器上每个 Raycast 变体。** Stable 和 Beta 可以共存，两者的 bundle ID
和配置目录不同：

| 变体 | App 路径 | Bundle ID | 配置目录 |
|---|---|---|---|
| Stable | `/Applications/Raycast.app` | `com.raycast.macos` | `~/.config/raycast` |
| Beta | `/Applications/Raycast Beta.app` | `com.raycast-x.macos` | `~/.config/raycast-x` |

```bash
ls /Applications | grep -i raycast
pgrep -lf Raycast | grep -v grep   # 当前实际运行的是哪个
```

**2. 确保 `raycast://` 指向用户实际使用的变体。** 一行安装脚本会执行
`open raycast://extensions/raycast/raycast/import-extension?path=...`，
URL 会被当前持有 `raycast://` scheme 的 app 接管 —— 两者都装时经常是错的。
显式重定向：

```bash
brew install duti                                   # 如未安装
duti -s com.raycast-x.macos raycast viewer          # Beta
# 或
duti -s com.raycast.macos   raycast viewer          # Stable
duti -x raycast                                     # 验证
```

**3. 确认导入是否真的落地。** 成功导入会创建
`~/.config/raycast*/extensions/vibelet-search/`：

```bash
find ~/.config -maxdepth 4 -name vibelet-search 2>/dev/null
```

如果输出为空，`import-extension` URL **没有**注册扩展（可能对话框被关闭，
或者 URL 被错误的 Raycast 接走）。**不要**重试 URL —— 直接走第 4 步，
这才是稳定的路径。

**4. 通过 `ray develop` 强制注册。** 这是最可靠的 sideload 方式：开发服务器
会和正在运行的 Raycast 通信并直接创建扩展目录。后台运行（进程必须保持存活，
此时 `ray develop` 是真相源）：

```bash
cd ~/.local/share/vibelet-search
npm run dev &                                       # 让 ray develop 后台跑
# 等几秒然后验证
find ~/.config -maxdepth 4 -name vibelet-search 2>/dev/null
```

目录出现后命令会立即出现在 Raycast 中。

**5.（可选）不依赖 `ray develop` 长跑。** 扩展目录存在后，`npm run sync`
会把 `dist/` 复制到所有已导入它的 Raycast 变体里，开发进程退出后扩展依然可用：

```bash
npm run build && npm run sync
# 然后可以安全终止后台的 ray develop：
kill %1
```

**6. 向用户汇报。** 告知用户：扩展注册到了哪个 Raycast 变体（Stable / Beta）、
`~/.config/raycast*/extensions/` 下新建的绝对路径，以及（如果走了第 2 步）
`raycast://` URL handler 已切换。如果你把 `ray develop` 留在后台运行，
明确告知用户以便后续停止。

## 偏好设置

- **Default Terminal** —— 选择你偏好的终端 app（Terminal.app / iTerm / Ghostty / WezTerm / Warp）
- **Claude CLI Path** —— 覆盖 `claude` 二进制名/路径（默认：`claude`）
- **Codex CLI Path** —— 覆盖 `codex` 二进制名/路径（默认：`codex`）

## 工作原理

扩展直接从磁盘读取会话文件：

- **Claude Code (CLI)** —— `~/.claude/sessions/*.json`（元数据）+ `~/.claude/projects/<encoded-path>/<session>.jsonl`（对话内容）
- **Claude Desktop (App)** —— `~/Library/Application Support/Claude/claude-code-sessions/<user>/<workspace>/local_*.json`（元数据：标题、PR 链接、活动时间戳）。对话 jsonl 是 `cliSessionId` 指向的 CLI 文件，因此 App 来源的会话与 CLI 共用同一份内容存储。
- **Codex CLI / Codex Desktop** —— 两者都写入 `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`。首行（`session_meta`）携带 `originator` 字段；当 `originator == "Codex Desktop"` 时标记为 **Codex App**，否则为 **Codex CLI**。`~/.codex/session_index.jsonl` 在存在时提供标题。

同一会话同时出现在 CLI 和 App 两个来源时（例如 Claude 在两者之间共享），
App 条目胜出，因为它携带更丰富的元数据。

为了在几千条会话规模下也能秒级启动，索引时只读取每个文件的前 ~64 KB
来提取标题。完整消息内容在打开会话详情视图时按需加载，
全文搜索委托给 ripgrep。

数据不离开本机，扩展不发起任何网络请求。

## 开发

```bash
npm install            # postinstall 拷贝 ripgrep 二进制到 assets/
npm test               # vitest
npm run dev            # `ray develop` —— 热重载进 Raycast
npm run build:sync     # 一次性：构建 + 推送 dist/ 到所有已导入扩展的
                       # Raycast 安装（Stable / Beta 等）。
                       # 不想保持 ray develop 长跑时使用。
```

`npm run sync` 会自动探测所有 `~/.config/raycast*/extensions/vibelet-search/`
并把 `dist/` 拷贝过去 —— 没有硬编码任何 Raycast 变体。

## 相关项目

- **[Vibelet](https://vibelet.icu)** —— 在手机上控制 Claude / Codex 编码 Agent。本扩展的桌面伴侣：在桌面用 Raycast 搜索会话，在手机上驱动它们。
