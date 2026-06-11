## SJTU Canvas 视频 (批量) 下载器

基于 **Electron + React + TypeScript** 的交大 Canvas 课堂视频下载工具，UI 采用 **Material You (MD3)** 设计规范。

> 本项目由 [prcwcy/sjtu-canvas-video-download](https://github.com/prcwcy/sjtu-canvas-video-download) 二次开发而来。详见 [NOTICE](NOTICE) 与 [LICENSE](LICENSE)（MIT）。

### 来源与变更说明

| | 原项目 (v1) | 本项目 (v2) |
|---|---|---|
| **仓库** | [prcwcy/sjtu-canvas-video-download](https://github.com/prcwcy/sjtu-canvas-video-download) | 本仓库 |
| **技术栈** | Python + Tkinter | Electron + React + TypeScript |
| **UI** | Tkinter 弹窗 | Material You 导航栏 + 多页面 |
| **下载** | aria2 子进程 / 串行 requests | Worker 线程池，可配置并发 |
| **打包** | PyInstaller | electron-builder |

**保留并移植的核心能力：**

- jAccount 账号密码 / 扫码登录
- 全量课程列表与 Canvas 课程 ID 模式
- LTI 鉴权与视频列表获取（`sjtu_real_canvas_video_v2` 逻辑）
- 课程 JSON 导入 / 导出、下载历史

**新增或改进：**

- Material You 界面（Roboto、药丸按钮、tonal 表面）
- 实时下载进度（速度、字节数、任务状态）
- 内置多线程下载，无需捆绑 aria2
- 会话与配置持久化至系统用户目录

### 架构

```
┌─────────────────────────────────────────────────────────┐
│  Renderer (React)          现代 UI、课程选择、进度展示   │
├─────────────────────────────────────────────────────────┤
│  Preload                   安全 IPC 桥接                 │
├─────────────────────────────────────────────────────────┤
│  Main Process              登录、API、下载调度、存储      │
│    ├── Canvas API 服务     课程列表 / OAuth 签名         │
│    ├── Download Manager    并发队列 + Worker 线程池      │
│    └── Storage Service     会话、配置、历史记录           │
└─────────────────────────────────────────────────────────┘
```

### 开发

需要 Node.js 18+。

```sh
npm install
npm run dev
```

### 构建

```sh
npm run build       # 编译
npm run dist:win    # Windows（exe 安装包 + 便携版）
npm run dist:linux  # Linux（deb）
npm run dist:mac    # macOS（dmg）
```

本地打包产物位于 `release/` 目录。

### 自动发布（GitHub Actions）

推送 `v*` 标签后，会自动在 Windows / Linux / macOS 三端构建并创建 GitHub Release：

```sh
git tag v2.0.0
git push origin v2.0.0
```

也可在 GitHub 仓库 **Actions → Release → Run workflow** 手动触发。

Release 附件包含：

| 平台 | 格式 |
|------|------|
| Windows | `.exe` 安装程序 + 便携版 |
| Linux | `.deb` |
| macOS | `.dmg` |

### 使用说明

1. **登录**：支持 jAccount 账号密码或扫码登录
2. **课程**：刷新全部课程，或输入 Canvas 课程 ID 获取指定课程
3. **下载**：选择科目和讲次范围，设置保存目录后开始下载
4. **历史**：查看并重新执行之前的下载任务

课程 ID 可在 Canvas 课程页面 URL 中找到，例如 `https://oc.sjtu.edu.cn/courses/12345` 中的 `12345`。

### 许可

本仓库以 [MIT License](LICENSE) 发布。原项目致谢见 [NOTICE](NOTICE)。
