## Agent skills

### Issue tracker

Issues live in this repo's self-hosted GitLab Issues, operated via the `glab` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five triage labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.

## 前端开发规范

### 对齐检查（强制）

修改任何前端文件（`*.html`、`*.js`、`*.css`）后，**必须**检查所有组件的对齐是否正确，尤其是 **SVG 图标与文字的对齐**：

- SVG 与相邻文字必须使用 `flex items-center` 实现垂直居中对齐
- SVG 与文字之间使用 `gap-2`（8px）保持一致间距
- 按钮内的 SVG + 文字组合必须包裹在 `flex items-center gap-2` 容器中
- 纯文字链接无需 `flex`，但含 SVG 的链接必须使用 flex 布局
- 检查所有 `class` 中含 `svg` 或 `<svg>` 标签的元素，确认其父容器有 `flex items-center`

此规范适用于 `index.html`、`results.html`、`chart.html` 及所有未来新增的前端页面。

### 弹出框裁切检查（强制）

修改任何前端文件（`*.html`、`*.js`、`*.css`）后，如果新增或修改了弹出层（tooltip、popover、modal、dropdown 等），**必须**检查弹出层是否被父容器的 `overflow: hidden` / `overflow: hidden` 裁切：

- `.glass-panel` 类自带 `overflow: hidden`，任何放在 `.glass-panel` 内部的弹出层都会被裁切
- 弹出层所在的最近父容器如果有 `overflow: hidden`、`overflow-x: hidden`、`overflow-y: hidden`，弹出层超出容器边界的部分将不可见
- 修复方式：给弹出层的直接父容器添加 `overflow-visible` 类覆盖 `overflow: hidden`
- 检查方法：用 Playwright 在目标视口下触发弹出层，截图确认弹出层完整可见、没有被卡片边框或容器边界裁切
- 特别注意 `absolute` / `fixed` 定位的弹出层，它们虽然脱离文档流但仍受 `overflow: hidden` 的视觉裁切

此规范适用于 `index.html`、`results.html`、`chart.html` 及所有未来新增的前端页面。
