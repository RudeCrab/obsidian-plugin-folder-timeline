[English](./README.md)

# Folder Timeline（文件夹时间线）

<div align="center" style="padding: 20px; margin: 20px 0;color: #8b5cf6;font-size: 40px;">

**把任意目录变成时间轴** 

</div>

![Sample](./docs/images/sample-zh.png)


## 使用方法

1. 在左侧 Ribbon 点击时间线图标，或在文件管理器的目录上右键选择「在此目录打开或创建 Timeline 视图」；
2. 插件自动创建视图配置文件（内容为默认模板，`folder` 已预填目标目录）并打开时间轴视图；
3. 在笔记 frontmatter 中写入 `start` / `end` 字段（或模板中配置的自定义字段名）即可上轴。

### 视图配置文件

视图配置文件是任意位置的普通 Markdown 文件，frontmatter 含 `timeline: true` 即被识别为视图配置文件。可在视图内通过表单编辑并保存，也可以直接编辑文件本身。

```yaml
---
timeline: true
folder: ""
recursive: false
startField: "start"
endField: "end"
showFileName: true
displayMode: "month"
sortBy: "start"
sortOrder: "asc"
---
```

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|---|---|---|---|---|
| `timeline` | boolean | 是 | - | 值为 `true` 时该文件才被视为视图配置文件 |
| `folder` | string | 是 | - | 要展示的目录，相对 vault 根目录的路径；空字符串表示 vault 根目录 |
| `recursive` | boolean | 否 | `false` | 是否递归扫描 `folder` 下的所有子目录 |
| `startField` | string | 是 | - | 开始时间字段名，读取每个文件 frontmatter 中该字段的值 |
| `endField` | string | 是 | - | 结束时间字段名 |
| `showFileName` | boolean | 否 | `true` | 是否在时间条上显示文件名 |
| `displayMode` | `"year"` \| `"month"` \| `"day"` | 否 | `"month"` | 时间轴刻度粒度 |
| `sortBy` | `"created"` \| `"modified"` \| `"start"` \| `"end"` | 否 | `"start"` | 时间条（从上到下）的排序依据 |
| `sortOrder` | `"asc"` \| `"desc"` | 否 | `"asc"` | 排序方向：正序（升序）/ 倒序（降序） |

**时间值写法**：支持 Obsidian frontmatter 中常见格式，如 `2026-08-06`、`2026-08-06T20:30:00`、`2026-08-06 20:30` 等。只有开始时间、无结束时间时渲染为单点事件（圆形标记）；开始时间晚于结束时间视为无效条目并在视图中汇总提示。

## 功能

- **两个入口**：
  - Ribbon 图标按钮：活动文件是视图配置文件 → 直接打开视图；否则在其所在目录新建配置文件并打开；
  - 文件管理器目录右键菜单「在此目录打开或创建 Timeline 视图」：为所选目录新建配置文件（`folder` 自动预填）并打开；目录下已有配置文件则直接打开。
- **自绘时间轴**（未使用任何现成 Gantt/Timeline 库）：按年 / 月 / 日三种刻度；时间轴范围自动覆盖全部条目；条目跨年 / 跨月正确跨越刻度。
- **时间条交互**：hover 反馈；点击 / 回车（键盘可聚焦）在 Obsidian 中打开对应笔记；可选在条上显示文件名（过长省略号截断）。
- **性能**：数百至上千文件采用可视区域渲染，滚动流畅。
- **视图内编辑配置**：配置表单修改后保存即写回配置文件 frontmatter 并立即刷新视图；也可直接编辑配置文件本身，重新打开视图时按新配置渲染。
- **边界情况友好**：配置损坏、目录不存在、目录为空、文件缺时间字段、开始晚于结束等均有明确提示，不崩溃。
- **本地优先**：无网络请求、无遥测、无远程代码执行。

## 安装

### 通过第三方插件（推荐）
1. 打开 Obsidian 软件 → 设置 → 第三方插件 → 浏览
2. 搜索【Folder Timeline】并安装
3. 启用插件

### 手动安装
1. 下载最新的 [Release](https://github.com/RudeCrab/obsidian-plugin-folder-timeline/releases)
2. 解压后将文件夹复制到 `<你的库>/.obsidian/plugins/`
3. 重启 Obsidian 并在设置中启用插件



## 开发

```bash
pnpm install   # 安装依赖（包管理器固定为 pnpm）
pnpm run dev   # 监听模式构建
pnpm run build # 生产构建，产出 main.js
pnpm run lint  # ESLint 检查
```

## License

MIT
