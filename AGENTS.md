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
