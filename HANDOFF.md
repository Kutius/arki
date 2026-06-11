# SoZip Phase 2 交接文档

## 项目概述

SoZip 是一款面向 Windows 的现代解压缩工具，UI 风格对标 Linear（干净、克制、高信息密度）。底层调用成熟的 Rust 压缩库，应用层采用 Tauri v2 + React + shadcn/ui 构建。

**核心原则**：不手写压缩算法，全部调用现代 Rust crate；UI 无多余装饰，每个像素都有用。

---

## 技术栈

| 层 | 选型 | 版本 |
|---|---|---|
| 桌面框架 | Tauri v2 | 2.x |
| 前端 | React 19 + TypeScript | React 19.1, TS 5.8 |
| 构建工具 | Vite | 7.x |
| UI 组件库 | shadcn/ui（代码复制到项目中，非 npm 包） | — |
| 样式 | Tailwind CSS 4（@tailwindcss/vite 插件） | 4.3 |
| 状态管理 | Zustand | 5.x |
| 图标 | Lucide React | — |
| 压缩库（Rust） | `zip` 2.2 | Phase 1 已集成 |

---

## 项目结构

```
C:\Users\kutius\projects\sozip\
├── src/                          # 前端源码
│   ├── components/
│   │   ├── ui/                   # shadcn/ui 组件（手动复制，可定制）
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   ├── context-menu.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── separator.tsx
│   │   │   └── tooltip.tsx
│   │   ├── layout/               # 布局组件
│   │   │   ├── Sidebar.tsx       # 侧边栏导航
│   │   │   ├── TitleBar.tsx      # 自定义标题栏（Tauri decorations:false）
│   │   │   └── StatusBar.tsx     # 底部状态栏
│   │   ├── file-list/
│   │   │   └── FileListView.tsx  # 文件列表视图（排序、面包屑、文件图标）
│   │   ├── detail-panel/
│   │   │   └── DetailPanel.tsx   # 右侧详情面板
│   │   └── dialogs/
│   │       └── ExtractDialog.tsx # 解压对话框
│   ├── hooks/
│   │   └── useKeyboardShortcuts.ts
│   ├── lib/
│   │   └── utils.ts              # cn() 工具函数
│   ├── store/
│   │   └── archiveStore.ts       # Zustand 全局状态
│   ├── App.tsx                   # 主应用组件
│   ├── globals.css               # Tailwind 入口 + 主题变量
│   └── main.tsx                  # React 入口
├── src-tauri/                    # Rust/Tauri 源码
│   ├── src/
│   │   ├── lib.rs                # Tauri commands 入口
│   │   └── services/
│   │       ├── mod.rs
│   │       └── archive.rs        # ArchiveService 实现
│   ├── capabilities/
│   │   └── default.json          # Tauri v2 权限声明
│   ├── tauri.conf.json           # Tauri 配置
│   ├── Cargo.toml                # Rust 依赖
│   └── icons/                    # 应用图标
├── package.json
├── vite.config.ts
├── tsconfig.json
└── index.html
```

---

## Tauri v2 关键配置

### 窗口配置（tauri.conf.json）

```json
{
  "decorations": false,       // 自定义标题栏
  "dragDropEnabled": true,    // 拖拽文件
  "resizable": true,
  "width": 1000, "height": 700
}
```

### 权限声明（capabilities/default.json）

```json
{
  "permissions": [
    "core:default",
    "core:window:allow-close",
    "core:window:allow-minimize",
    "core:window:allow-toggle-maximize",
    "core:window:allow-start-dragging",
    "core:window:allow-set-focus",
    "opener:default",
    "dialog:default"
  ]
}
```

**重要**：Tauri v2 的每个窗口操作都需要显式声明权限，否则控制台报错但不崩溃。新增功能时如需新的 window/event 权限，先在 `src-tauri/gen/schemas/desktop-schema.json` 中 grep 确认权限名称存在。

---

## 当前已实现功能（Phase 1）

### 前端
- [x] 自定义标题栏（最小化/最大化/关闭）
- [x] 侧边栏导航（Recent, Favorites, Formats 分组）
- [x] 文件列表视图（排序、面包屑导航、文件类型图标）
- [x] 右侧详情面板（文件属性、压缩比、归档统计）
- [x] 底部状态栏（状态文字、项目数、总大小）
- [x] 右键菜单（Extract to... / Open / Preview）
- [x] 解压对话框（选择目标文件夹、覆盖选项）
- [x] 拖拽打开 ZIP 文件（Tauri 原生 onDragDropEvent）
- [x] 拖拽悬停视觉反馈（半透明遮罩 + 提示文字）
- [x] 键盘快捷键（Ctrl+E 解压，Escape 关闭对话框）
- [x] Zustand 状态管理（archiveStore）

### Rust
- [x] ZIP 格式读取（list_archive）
- [x] ZIP 格式解压（extract_archive）
- [x] ArchiveEntry / ArchiveInfo 数据结构
- [x] ExtractOptions 结构
- [x] Tauri commands 暴露给前端

### 构建产物
- MSI: `src-tauri/target/release/bundle/msi/sozip_0.1.0_x64_en-US.msi`
- NSIS: `src-tauri/target/release/bundle/nssis/sozip_0.1.0_x64-setup.exe`

---

## Phase 2 目标

**格式扩展 + 创建压缩包**，具体：

### Step 1: TAR.GZ 支持
- 添加 `tar` 和 `flate2` crate
- 实现 TAR.GZ 的 list / extract
- ArchiveService 中增加 format dispatch 逻辑

### Step 2: Brotli / Zstandard 支持
- 添加 `brotli` 和 `zstd` crate
- 实现对应格式的 list / extract

### Step 3: 7z 支持
- 添加 `sevenz-rs` crate
- 实现 7z 的 list / extract

### Step 4: RAR 只读支持
- 添加 `unrar` crate
- 仅支持解压（RAR 专利限制，不支持创建）

### Step 5: ArchiveService 重构
- 当前是 `list_zip` / `extract_zip` 硬编码
- 重构为 format dispatcher：根据扩展名分发到对应实现
- 统一接口，新增格式只需实现 trait 方法

### Step 6: 创建压缩包
- Rust 端：`create_archive` command
- 前端：创建压缩包对话框（选择文件 → 选择格式 → 压缩级别 → 创建）
- 支持的创建格式：ZIP, TAR.GZ, 7z

### Step 7: 密码支持
- ZIP / 7z 的加密解压
- 密码输入对话框

---

## 编码规范

### 前端
- **组件**：函数组件 + hooks，不用 class components
- **样式**：Tailwind CSS utility classes，不用 CSS Modules
- **shadcn/ui 组件**：直接复制到 `components/ui/`，可自由定制
- **状态管理**：Zustand store 放 `store/` 目录
- **工具函数**：放 `lib/` 目录
- **自定义 hooks**：放 `hooks/` 目录
- **命名**：组件 PascalCase，hooks/useXxx，其他 camelCase
- **import 路径**：使用相对路径 `../../lib/utils`

### Rust
- **模块组织**：`services/` 放服务层，`lib.rs` 放 Tauri commands
- **错误处理**：返回 `Result<T, String>`，用 `.map_err(|e| format!("..."))` 转换
- **序列化**：所有暴露给前端的结构加 `#[derive(Serialize, Deserialize)]`
- **命令注册**：在 `lib.rs` 的 `invoke_handler` 中用 `generate_handler![]` 注册

### Tauri v2 注意事项
- **权限**：每个新功能都需要检查是否需要在 `capabilities/default.json` 添加权限
- **权限名称验证**：新增权限前先在 `src-tauri/gen/schemas/desktop-schema.json` 中 grep 确认存在
- **事件监听**：拖拽等原生事件用 `getCurrentWindow().onXxxEvent()` 而非浏览器 API
- **构建**：`pnpm tauri build` 会同时构建前端和 Rust

---

## 常用命令

```bash
# 开发
pnpm tauri dev

# 构建前端
pnpm build

# 构建 Rust（不构建前端）
cd src-tauri && cargo build

# 完整构建（前端 + Rust + 安装包）
pnpm tauri build

# 添加前端依赖
pnpm add <package>

# 添加 Rust 依赖
# 编辑 src-tauri/Cargo.toml 后 cargo build 会自动下载
```

---

## 已知问题 / 注意事项

1. **Sidebar NavItem**：曾用 Tooltip + Button + asChild 组合，在 WebView2 中有事件问题，已简化为原生 `<button>`。如需加 Tooltip，注意测试点击是否正常。

2. **drag-drop 事件**：浏览器原生 drag/drop API 在 Tauri 中不可用（拿不到文件路径），必须用 `getCurrentWindow().onDragDropEvent()`。

3. **事件传播**：`e.stopPropagation()` 可能导致其他元素点击失效，谨慎使用。

4. **pnpm builds**：首次安装依赖需要 approve esbuild 的 build script（已在 `pnpm-workspace.yaml` 中配置 `allowBuilds: esbuild: true`）。

5. **RAR 格式**：只能解压不能创建，这是专利限制。

---

## 设计参考

- **Linear 风格**：深色背景（oklch(0.145 0 0)）、无边框、间距分隔、150ms 以内动画
- **主题变量**：在 `globals.css` 的 `@theme inline` 中定义，使用 oklch 色彩空间
- **字体**：Inter（系统字体栈兜底）
