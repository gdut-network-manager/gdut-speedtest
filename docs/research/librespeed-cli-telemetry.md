# LibreSpeed CLI 测速结果不上报问题研究

## 问题描述

使用 LibreSpeed CLI (`librespeed/speedtest-cli`) 对测速站测速时，测速能正常完成，但结果不会记录到网站的 `backend/report.php` 中。

## 根因分析

### CLI 遥测机制

LibreSpeed CLI **原生支持遥测**，测速完成后会以 `multipart/form-data` POST 请求发送到指定的遥测端点。

CLI 发送的字段（源码：`speedtest/helper.go#L213-L274`）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `ispinfo` | JSON | `getIP.php` 返回的 ISP 信息（含 `processedString` 和 `rawIspInfo`） |
| `dl` | float | 下载速度 (Mbps) |
| `ul` | float | 上传速度 (Mbps) |
| `ping` | float | Ping (ms) |
| `jitter` | float | 抖动 (ms) |
| `log` | string | 测试日志 |
| `extra` | JSON | 额外信息（服务器名 + 自定义消息） |

CLI 还期望服务器返回 `"id <数字ID>"` 格式的响应（`helper.go#L312-L319`）。

### 我们的 report.php 期望的字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `key` | string | `sha1(ip)` 去重键 |
| `ip` | string | IP 地址 |
| `isp` | string | 运营商 |
| `addr` | string | 城市/地区 |
| `dspeed` | float | 下载速度 |
| `uspeed` | float | 上传速度 |
| `ping` | float | Ping |
| `jitter` | float | 抖动 |

### 不匹配点

1. **字段名不同**：CLI 发 `dl`/`ul`，report.php 期望 `dspeed`/`uspeed`
2. **ISP 信息格式不同**：CLI 发 `ispinfo` JSON（含 `processedString`），report.php 期望分开的 `ip`/`isp`/`addr`
3. **CLI 缺少 `key` 字段**：report.php 用 `key` 做去重
4. **响应格式**：report.php 不返回 `"id <ID>"`，CLI 会报错

### 结论

- **前端无法解决**：CLI 是独立 Go 二进制，不受网站前端控制
- **后端可解决**：修改 `report.php` 兼容 CLI 的字段格式
- **无需改 CLI**：CLI 已支持 `--telemetry-server`/`--telemetry-path` 指向我们的后端

## 解决方案

### 修改 `backend/report.php`

检测请求格式（CLI vs Web 前端），分别解析字段：

1. 检测 `ispinfo` 字段是否存在 → CLI 请求
2. 从 `ispinfo` JSON 的 `processedString` 解析 IP/ISP/地址（格式：`IP - ISP - Country,Region,City`）
3. 映射 `dl`→`dspeed`，`ul`→`uspeed`
4. 生成 `key = sha1(ip)`
5. 返回 `"id <record_id>"` 响应

### CLI 使用方式

```bash
librespeed-cli \
  --local-json servers.json \
  --telemetry-level full \
  --telemetry-server https://speed.gdut.edu.cn \
  --telemetry-path /backend/report.php \
  --telemetry-share /results.html
```

或用配置文件 `telemetry.json`：

```json
{
  "telemetryLevel": "full",
  "server": "https://speed.gdut.edu.cn",
  "path": "/backend/report.php",
  "shareURL": "/results.html"
}
```

## 来源

- CLI 源码：https://github.com/librespeed/speedtest-cli (commit `2f240876`)
- `speedtest/helper.go#L213-L321`：`sendTelemetry` 函数
- `speedtest/speedtest.go#L95-L141`：遥测配置解析
- `defs/telemetry.go#L62-L123`：`TelemetryServer` 结构体与 URL 拼接
- `main.go#L183-L210`：CLI 标志定义
