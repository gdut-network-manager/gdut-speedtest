# 测速报告接口（report.php）防伪造调研报告

## 1. 漏洞确认：当前 report.php 为什么可以被伪造

### 1.1 漏洞概述

本项目 `backend/report.php` 是一个完全开放的 POST 接口，**无任何鉴权、无 token、无来源验证、无速率限制**。攻击者可以用一行 curl 命令伪造任意测速记录并写入数据库。

### 1.2 当前代码分析

[本地仓库 `backend/report.php`](https://github.com/gregPerlinLi/gdutnic-speedtest-x/blob/1646822edccb632c6b02f80468853ecc29238284/backend/report.php#L1-L129)

关键漏洞点：

```php
// 第 79-92 行：Web 端请求直接从 $_POST 取值，无任何校验
$reportData = [
    "key" => sha1(filter_var($_POST['key'], FILTER_SANITIZE_STRING)),
    "ip" => filter_var($_POST['ip'], FILTER_SANITIZE_STRING),
    "isp" => filter_var($_POST['isp'], FILTER_SANITIZE_STRING),
    "addr" => filter_var($_POST['addr'], FILTER_SANITIZE_STRING)),
    "dspeed" => (double) filter_var($_POST['dspeed'], FILTER_SANITIZE_STRING),
    "uspeed" => (double) filter_var($_POST['uspeed'], FILTER_SANITIZE_STRING),
    "ping" => (double) filter_var($_POST['ping'], FILTER_SANITIZE_STRING),
    "jitter" => (double) filter_var($_POST['jitter'], FILTER_SANITIZE_STRING),
    // ...
    "created" => date('Y-m-d H:i:s', time()),
];
```

存在的问题：

| 问题 | 详情 |
|------|------|
| **无鉴权** | 不检查任何 token、session、cookie、API key |
| **无来源验证** | 不检查 HTTP Referer / Origin 头 |
| **IP 由客户端提供** | `$_POST['ip']` 由前端提交，服务端不使用 `$_SERVER['REMOTE_ADDR']` |
| **速度值无校验** | `dspeed`/`uspeed` 直接 `(double)` 转换后入库，不验证是否合理 |
| **无速率限制** | 同一 IP 可无限次提交 |
| **无时间窗口校验** | 不记录测速开始时间，无法判断上报时序是否合理 |

### 1.3 具体攻击方式

攻击者只需知道接口 URL，即可用 curl 伪造记录：

```bash
# 伪造一条 1000Mbps 的虚假测速记录
curl -X POST https://your-domain/backend/report.php \
  -d "key=fakekey&ip=1.2.3.4&isp=FakeISP&addr=FakeLocation&dspeed=1000&uspeed=500&ping=1&jitter=0.5"

# 批量伪造（循环提交）
for i in $(seq 1 100); do
  curl -s -X POST https://your-domain/backend/report.php \
    -d "key=fake$i&ip=10.0.0.$i&isp=Attacker&addr=Nowhere&dspeed=9999&uspeed=9999&ping=0&jitter=0"
done
```

> **注意**：CLI 请求路径（`$isCliRequest` 分支，第 27-77 行）虽然从 `ispinfo` 中解析 IP，但 `dl`/`ul`/`ping`/`jitter` 仍然完全信任客户端提交的值，同样可被伪造。

### 1.4 前端数据提交方式

前端 `speedtest_worker.js` 的 `sendTelemetry()` 函数通过 `XMLHttpRequest` POST 发送 `FormData`，**没有附加任何认证信息**，攻击者完全可以复制这些参数用 curl 重放。

---

## 2. LibreSpeed 原项目及其他主流测速项目如何防止伪造

### 2.1 LibreSpeed 原项目（librespeed/speedtest）

**结论：LibreSpeed 原项目的 telemetry 接口同样没有防伪造措施。**

LibreSpeed 原项目的遥测接口位于 `results/telemetry.php`（[源码 permalink](https://github.com/librespeed/speedtest/blob/3ada090eefc2443994f9f4a27c2b925cba0f5cfa/results/telemetry.php#L1-L50)）：

```php
$ip = getClientIp();
$ispinfo = $_POST['ispinfo'];
$extra = $_POST['extra'];
$ua = $_SERVER['HTTP_USER_AGENT'];
$lang = $_SERVER['HTTP_ACCEPT_LANGUAGE'] ?? '';
$dl = $_POST['dl'];
$ul = $_POST['ul'];
$ping = $_POST['ping'];
$jitter = $_POST['jitter'];
$log = $_POST['log'];
// ...直接调用 insertSpeedtestUser() 入库
```

**与本项目一样，`dl`/`ul`/`ping`/`jitter` 全部直接从 `$_POST` 读取，无校验。**

LibreSpeed 原项目的安全措施仅限于：

| 措施 | 位置 | 防伪造？ | 说明 |
|------|------|----------|------|
| `$stats_password` | [telemetry_settings.php](https://github.com/librespeed/speedtest/blob/3ada090eefc2443994f9f4a27c2b925cba0f5cfa/results/telemetry_settings.php#L5) | 否 | 仅保护 **查看** 结果的 stats.php，不保护 **提交** |
| `$enable_id_obfuscation` | [telemetry_settings.php](https://github.com/librespeed/speedtest/blob/3ada090eefc2443994f9f4a27c2b925cba0f5cfa/results/telemetry_settings.php#L7) | 否 | 仅混淆结果 ID，防止猜测其他用户的结果 URL |
| `$redact_ip_addresses` | [telemetry_settings.php](https://github.com/librespeed/speedtest/blob/3ada090eefc2443994f9f4a27c2b925cba0f5cfa/results/telemetry_settings.php#L9) | 否 | 隐私保护，不防伪造 |
| PDO 预处理语句 | [telemetry_db.php](https://github.com/librespeed/speedtest/blob/3ada090eefc2443994f9f4a27c2b925cba0f5cfa/results/telemetry_db.php#L176-L182) | 否 | 防 SQL 注入，不防伪造 |
| `htmlspecialchars()` | [stats.php](https://github.com/librespeed/speedtest/blob/3ada090eefc2443994f9f4a27c2b925cba0f5cfa/results/stats.php) | 否 | 防 XSS，不防伪造 |
| IP 由服务端获取 | [telemetry.php 第 9 行](https://github.com/librespeed/speedtest/blob/3ada090eefc2443994f9f4a27c2b925cba0f5cfa/results/telemetry.php#L9) | 部分 | LibreSpeed 用 `getClientIp()` 获取 IP（比本项目好），但速度值仍可伪造 |

**已披露的 CVE 记录**：

LibreSpeed 已有公开的安全公告 [GHSA-3954-xrwh-fq4q](https://github.com/librespeed/speedtest/security/advisories/GHSA-3954-xrwh-fq4q)（CVE-2024-32890），该公告的 PoC **直接展示了用 curl 伪造测速结果**：

```bash
curl "http://localhost/results/telemetry.php" \
  --data 'ispinfo={"processedString":"foo - bar "}&dl=1&ul=1&ping=1&jitter=1&log=&extra='
```

这证实了 LibreSpeed 官方也承认 telemetry 接口可被直接 curl 调用伪造数据。不过该 CVE 关注的是 **存储型 XSS**（`processedString` 未转义），而非速度值伪造本身。

### 2.2 speedtest-x（BadApple9/speedtest-x）

speedtest-x fork 的 `backend/report.php`（[源码 permalink](https://github.com/BadApple9/speedtest-x/blob/dd8bbe1080cdfb960307540cff47e76080e4083e/backend/report.php#L1-L60)）与本项目几乎一致，**同样无任何防伪造措施**。

### 2.3 Ookla speedtest.net

根据安全研究项目 [Hack_Speedtest_Ookla](https://github.com/shakilofficial0/Hack_Speedtest_Ookla) 的分析，Ookla 的防护措施及其弱点如下：

| 防护措施 | 弱点 |
|----------|------|
| MD5 哈希验证 | 哈希公式可被逆向，攻击者知道公式后即可生成有效哈希 |
| Session Cookie (`stnetsid`) | Cookie 可被窃取/重放，或匿名提交 |
| 每设备每天限制 | 可通过伪造设备指纹绕过 |

该研究项目提出的理想方案是 **GUID 服务端追踪机制**：
1. 测速开始时服务端生成唯一 GUID
2. 客户端实时上报原始测量数据到服务端（非最终计算值）
3. 服务端维护权威数据副本，自行计算最终结果
4. 结果提交时客户端只发送 GUID，服务端从已存储的测量数据中生成结果

### 2.4 Cloudflare speed.cloudflare.com

Cloudflare 的测速方案（[cloudflare/speedtest](https://github.com/cloudflare/speedtest)）采用不同的架构：

- 测速引擎是一个 JavaScript 模块，运行在浏览器中
- 下载/上传测试直接请求 Cloudflare 边缘节点的 `__down`/`__up` 端点
- 使用浏览器原生 `PerformanceResourceTiming` API 提取时序数据
- **结果在客户端计算，不需要单独的上报接口**——结果直接显示给用户

Cloudflare 的模式本质上不存储测速记录供公开展示，因此不面临上报伪造问题。

### 2.5 对比总结

| 项目 | 防伪造措施 | 效果 |
|------|-----------|------|
| **LibreSpeed 原项目** | 无 | 可直接 curl 伪造 |
| **speedtest-x (BadApple9)** | 无 | 可直接 curl 伪造 |
| **本项目 (gdutnic-speedtest-x)** | 无 | 可直接 curl 伪造 |
| **Ookla speedtest.net** | MD5 哈希 + Session Cookie | 可被逆向/重放 |
| **Cloudflare speed.cloudflare.com** | 不存储公开记录 | 不存在此问题 |

---

## 3. 可落地的防护方案（分层防御）

以下方案从简单到复杂排列，分为"提高伪造门槛"和"接近完全防伪造"两个层次。

### 方案 1：HTTP Referer / Origin 校验

**原理**：检查请求的 `Referer` 或 `Origin` HTTP 头，确认请求来自本站页面。

**依据**：
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Stack Overflow: PHP block curl POST](https://stackoverflow.com/questions/62644315/php-block-a-client-to-use-curl-to-send-post-requests-to-my-website)

**实现思路**：
- 在 report.php 开头检查 `$_SERVER['HTTP_REFERER']` 或 `$_SERVER['HTTP_ORIGIN']`
- 只允许来自本站的 Referer（匹配配置的域名）
- 缺少或不匹配时直接 `exit`

| 维度 | 评价 |
|------|------|
| **防伪造效果** | 提高门槛（非完全防护） |
| **优点** | 实现极简，零侵入，无需前端改动 |
| **缺点** | Referer 可被伪造（curl 加 `-H "Referer: ..."` 即可绕过）；部分浏览器/隐私设置会去掉 Referer |
| **实现复杂度** | 极低（report.php 加 5-10 行） |
| **代码侵入** | 极低（仅 report.php 头部加检查） |
| **单独使用** | 不够，curl 可轻松绕过 |

### 方案 2：服务端签发 Token（测速开始时发 token，上报时校验）

**原理**：测速页面加载时，服务端生成一次性 token 并嵌入页面；前端上报测速结果时必须携带该 token；服务端校验 token 有效性后才写入数据。

**依据**：
- [OWASP CSRF Prevention Cheat Sheet - Synchronizer Token Pattern](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Stack Overflow: PHP CSRF token](https://stackoverflow.com/questions/5207160/what-is-a-csrf-token-what-is-its-importance-and-how-does-it-work)
- [khalil-shreateh.com: Securing PHP AJAX endpoint](https://khalil-shreateh.com/khalil.shtml/it-highlights/awareness-and-security/45190-securing-a-php-endpoint-called-via-ajax-direct-access-csrf-and-rate-limiting.html)

**实现思路**：
1. 新增 `backend/token.php`：生成随机 token，存入 PHP session 或文件，返回给前端
2. 前端 `index.html` 加载时请求 token，存入变量
3. `sendTelemetry()` 上报时在 POST 数据中附加 `token` 字段
4. `report.php` 开头校验 token：存在性 + 有效性 + 是否过期（如 10 分钟内）
5. 校验通过后删除/失效该 token（一次性使用）

| 维度 | 评价 |
|------|------|
| **防伪造效果** | 显著提高门槛 |
| **优点** | 标准 CSRF 防御，业界成熟；token 一次性使用防止重放；不依赖 Referer |
| **缺点** | 攻击者可先请求 token.php 获取 token，再伪造请求（需配合 Referer/Origin 校验）；需引入 session 或文件存储 token |
| **实现复杂度** | 中等（新增 1 个 PHP 文件 + 修改前端 JS + 修改 report.php） |
| **代码侵入** | 中等（前端需改 sendTelemetry，后端需新增 token 接口） |
| **SleekDB 约束** | token 存储可用 SleekDB 或简单文件/PHP session；PHP session 在 Docker 中需注意共享存储 |

> **关键限制**：如果攻击者能用 curl 先请求 token.php 获取 token，再请求 report.php，则可绕过。因此 token 方案需配合 Referer/Origin 校验（方案 1）或 HMAC 签名（方案 3）使用。

### 方案 3：HMAC 签名

**原理**：服务端持有一个密钥（secret key），前端在上报测速结果时用该密钥对请求数据计算 HMAC 签名，服务端重新计算并验证签名是否匹配。

**依据**：
- [OWASP CSRF Prevention Cheat Sheet - Signed Double-Submit Cookie](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [EverBytes: Hardening PHP Webhooks with HMAC Signatures](https://everbytes.dazzbytes.com/php/hardening-php-webhooks-preventing-spoofing-with-hmac-signatures)
- [techearl.com: Securing PHP REST API endpoint with HMAC](https://techearl.com/wordpress-secure-rest-api-write-endpoint)

**实现思路**：
1. 服务端在 `config.php` 中定义一个密钥常量 `REPORT_SECRET`
2. 前端获取该密钥（通过 token.php 接口下发，或嵌入页面）
3. 前端上报时：`signature = hash_hmac('sha256', postData + timestamp, secret)`
4. 前端在请求头中携带 `X-Signature` 和 `X-Timestamp`
5. 服务端用相同密钥重新计算 HMAC，用 `hash_equals()` 常量时间比较

| 维度 | 评价 |
|------|------|
| **防伪造效果** | 高（密钥不泄露则无法伪造） |
| **优点** | 密钥不随请求传输，抓包也无法重放（配合时间戳）；`hash_equals()` 防时序攻击 |
| **缺点** | **前端 JS 中的密钥可被查看**（F12 即可看到），这是客户端 HMAC 的根本矛盾；需配合时间戳+nonce 防重放 |
| **实现复杂度** | 中高（前端需引入 HMAC 计算库或手写，后端需改 report.php） |
| **代码侵入** | 中高（前端 JS 需改 sendTelemetry，后端需改 report.php） |
| **SleekDB 约束** | nonce 防重放需存储已用 nonce（可用 SleekDB 或文件） |

> **来源依据**：EverBytes 文档明确指出 "the secret never crosses the wire"，但客户端 HMAC 的密钥必须在前端 JS 中可用，因此实际上密钥会暴露在页面源码中。这是所有前端签名方案的固有局限。OWASP 建议在 HMAC 消息中包含 session ID 等服务端数据来增强安全性。

### 方案 4：速率限制（Rate Limiting）

**原理**：限制同一 IP 在单位时间内的提交次数，防止批量伪造。

**依据**：
- [NGINX Blog: Rate Limiting with NGINX](https://blog.nginx.org/blog/rate-limiting-nginx)
- [getpagespeed.com: NGINX Rate Limiting Complete Guide 2026](https://www.getpagespeed.com/server-setup/nginx/nginx-rate-limiting)
- [henryk.tews.pl: REST API security with nginx rate limiting](https://henryk.tews.pl/en/rest-api-security-tokens-acl-nginx-rate-limiting-monitoring/)
- [linuxcapable.com: Configure Nginx Rate Limiting](https://linuxcapable.com/how-to-rate-limit-in-nginx/)

**两种实现层次**：

#### 4a. Nginx 层速率限制（推荐首选）

```nginx
# http 块
limit_req_zone $binary_remote_addr zone=report:10m rate=2r/m;

# server 块中的 report.php 位置
location = /backend/report.php {
    limit_req zone=report burst=3 nodelay;
    limit_req_status 429;
}
```

#### 4b. PHP 应用层速率限制

在 report.php 中用文件或 SleekDB 记录每个 IP 的提交时间戳，超限则拒绝。

| 维度 | 评价 |
|------|------|
| **防伪造效果** | 提高门槛（限制批量伪造，不防单条伪造） |
| **优点** | Nginx 层零代码侵入，纯配置；PHP 层可更精细控制 |
| **缺点** | 不防单条伪造；NAT 后多用户共享 IP 可能误伤；攻击者可换 IP 绕过 |
| **实现复杂度** | Nginx：低（纯配置）；PHP：中（需写限流逻辑） |
| **代码侵入** | Nginx：零；PHP：中 |
| **Docker 约束** | 本项目 Docker 使用 Apache（php:7.4-apache），需用 `.htaccess` 的 `mod_evasive` 或改用 Nginx 镜像 |

### 方案 5：测速过程校验（服务端记录测速开始时间，上报时校验时间差）

**原理**：测速开始时前端请求服务端记录开始时间戳（可结合 token 方案），上报结果时服务端校验从开始到上报的时间差是否合理（一次完整测速通常需要 15-60 秒）。

**依据**：
- [Hack_Speedtest_Ookla - GUID-based tracking](https://github.com/shakilofficial0/Hack_Speedtest_Ookla) — "Server generates a unique GUID when speed test begins" + "Timeout: GUIDs expire if no final submission within 1 hour"
- [shakilofficial0/Hack_Speedtest_Ookla - Immediate Actions](https://github.com/shakilofficial0/Hack_Speedtest_Ookla) — "Implement timing-based validation (results must take minimum time)"

**实现思路**：
1. 测速开始时，前端请求 `backend/start.php`，服务端生成 token + 记录开始时间戳
2. 前端正常执行测速（下载 -> ping -> 上传，通常 15-60 秒）
3. 上报结果时携带 token，服务端校验：
   - token 有效
   - 当前时间 - 开始时间 >= 最低阈值（如 10 秒）
   - 当前时间 - 开始时间 <= 最高阈值（如 5 分钟）
4. 时间差不合理则拒绝

| 维度 | 评价 |
|------|------|
| **防伪造效果** | 显著提高门槛 |
| **优点** | 攻击者必须先请求 start.php 再等待合理时间才能伪造，大幅增加自动化成本；与 token 方案天然结合 |
| **缺点** | 攻击者仍可先请求 start.php 再 `sleep 15` 后伪造；需额外存储开始时间 |
| **实现复杂度** | 中等（新增 start.php + 修改前端 + 修改 report.php） |
| **代码侵入** | 中等 |
| **SleekDB 约束** | 可用 SleekDB 存储会话记录（token + 时间戳），定期清理过期记录 |

### 方案 6：反向代理层防护（Nginx/Apache 层）

**原理**：在 Web 服务器层面增加防护，不依赖 PHP 代码。

**依据**：
- [NGINX Blog: Rate Limiting](https://blog.nginx.org/blog/rate-limiting-nginx)
- [serverfault.com: Rate limit PHP endpoints with nginx + php-fpm](https://serverfault.com/questions/1127879/rate-limit-specific-php-endpoints-when-running-nginx-with-php-fpm)
- [Fastly Blog: UA Spoofing Detection](https://www.fastly.com/blog/ua-spoofing-101-detection-defense-with-fastlys-next-gen-waf)

**可选措施**：

| 措施 | 效果 | 来源 |
|------|------|------|
| Nginx `limit_req` 速率限制 | 限制请求频率 | [NGINX Blog](https://blog.nginx.org/blog/rate-limiting-nginx) |
| Nginx `valid_referers` | 检查 Referer | Nginx 官方文档 |
| Apache `mod_evasive` | 速率限制 + 临时封禁 | Apache 模块文档 |
| WAF (如 Fail2Ban) | 自动封禁异常 IP | [henryk.tews.pl](https://henryk.tews.pl/en/rest-api-security-tokens-acl-nginx-rate-limiting-monitoring/) |
| TLS/JA3 指纹 | 区分浏览器与 curl/脚本 | [Fastly Blog](https://www.fastly.com/blog/ua-spoofing-101-detection-defense-with-fastlys-next-gen-waf) |

| 维度 | 评价 |
|------|------|
| **防伪造效果** | 提高门槛（配合其他方案效果更好） |
| **优点** | 零代码侵入；在流量到达 PHP 前拦截；性能高 |
| **缺点** | 本项目 Docker 用 Apache，Nginx 方案需换镜像或加反向代理层；TLS 指纹需商业 WAF |
| **实现复杂度** | 低-中（取决于方案） |
| **代码侵入** | 零（纯基础设施配置） |
| **Docker 约束** | Apache 下可用 `.htaccess` + `mod_rewrite` 做基本防护；Nginx 需改 Dockerfile 或加前置代理 |

### 方案 7：验证码 / 人机验证

**原理**：在测速完成后、结果上报前，要求用户完成验证码验证（如 hCaptcha、reCAPTCHA、Cloudflare Turnstile）。

**依据**：
- [Stack Overflow: PHP block curl POST](https://stackoverflow.com/questions/62644315/php-block-a-client-to-use-curl-to-send-post-requests-to-my-website) — "A captcha should be pretty much unbeatable by a non-human / non-browser client"
- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

| 维度 | 评价 |
|------|------|
| **防伪造效果** | 最强（接近完全防伪造） |
| **优点** | 有效区分人类与自动化脚本；Cloudflare Turnstile 免费且无感验证 |
| **缺点** | 用户体验影响大（尤其传统验证码）；增加前端依赖；需外部服务调用 |
| **实现复杂度** | 中（前端嵌入验证码组件 + 后端验证 API 响应） |
| **代码侵入** | 中高（前端需加验证码 UI，后端需加验证逻辑） |
| **推荐** | Cloudflare Turnstile（免费、无感、隐私友好）> hCaptcha > reCAPTCHA |

---

## 4. 方案对比总表

| 方案 | 防伪造层次 | 实现复杂度 | 代码侵入 | 单独有效？ | Docker 友好？ |
|------|-----------|-----------|---------|-----------|-------------|
| 1. Referer/Origin 校验 | 提高门槛 | 极低 | 极低 | 否 | 是 |
| 2. 服务端 Token | 提高门槛 | 中 | 中 | 需配合 1 | 是 |
| 3. HMAC 签名 | 提高门槛 | 中高 | 中高 | 密钥暴露 | 是 |
| 4. 速率限制 | 提高门槛 | 低(Nginx)/中(PHP) | 零/中 | 否 | Apache 需调整 |
| 5. 测速过程校验 | 提高门槛 | 中 | 中 | 需配合 2 | 是 |
| 6. 反向代理防护 | 提高门槛 | 低-中 | 零 | 否 | 需 Nginx |
| 7. 验证码 | 接近完全 | 中 | 中高 | 是 | 是 |

**关键区分**：
- **"提高伪造门槛"**（方案 1-6）：增加攻击成本，但坚定的攻击者仍可绕过。前端密钥/token 可通过 F12 或先请求接口获取。
- **"接近完全防伪造"**（方案 7）：验证码依赖第三方服务的人类验证，自动化脚本无法绕过（除非使用打码平台）。

---

## 5. 推荐方案

### 5.1 项目约束分析

| 约束 | 影响 |
|------|------|
| PHP 7.4 | 无法使用 PHP 8+ 特性，但 `hash_hmac()`、`hash_equals()`、`random_bytes()` 均可用 |
| SleekDB（JSON 文件数据库） | 可存储 token/会话记录，但并发写入性能有限；不宜高频读写 |
| Docker（php:7.4-apache） | Apache 环境，Nginx 方案需换镜像或加前置代理；`.htaccess` 可用 |
| 轻量部署 | 不宜引入 Redis/数据库等额外依赖 |
| 无用户登录系统 | 无法使用基于用户身份的鉴权，只能基于 IP/session/token |

### 5.2 推荐分层方案

考虑到项目是轻量自部署的测速工具，建议采用 **三层防御**，从低成本到高成本递进：

#### 第一层（立即可做，零成本）：Referer/Origin 校验 + 速率限制

- **Referer/Origin 校验**：在 report.php 头部加 5-10 行检查，拒绝非本站来源的请求
- **Apache 速率限制**：在 Docker 镜像中启用 `mod_evasive` 模块，或用 `.htaccess` 限制
- **效果**：挡住最简单的 curl 直接攻击和批量伪造
- **成本**：极低，无需改前端

#### 第二层（短期，中等成本）：Token + 时间窗口校验

- **新增 `backend/token.php`**：测速开始时生成一次性 token + 时间戳，存入 SleekDB
- **修改前端 `speedtest_worker.js`**：`sendTelemetry()` 上报时携带 token
- **修改 `report.php`**：校验 token 有效性 + 时间差（10 秒 - 5 分钟）
- **效果**：攻击者必须先请求 token.php 再等待合理时间才能伪造，大幅提高自动化成本
- **成本**：新增 1 个 PHP 文件，修改前端 JS 和 report.php

#### 第三层（可选，高成本）：Cloudflare Turnstile 验证码

- **前端**：在测速完成后嵌入 [Cloudflare Turnstile](https://developers.cloudflare.com/turnstile/)（免费、无感验证）
- **后端**：report.php 校验 Turnstile token
- **效果**：接近完全防伪造，自动化脚本无法绕过
- **成本**：需注册 Cloudflare 账号获取 site key/secret，前端加验证码组件

### 5.3 不推荐的方案

| 方案 | 不推荐原因 |
|------|-----------|
| 纯 HMAC 签名 | 前端 JS 中的密钥可通过 F12 查看，安全性不如 token + Referer 组合 |
| 换 Nginx 镜像 | 项目 Docker 基于 Apache，换镜像影响面大 |
| 引入 Redis/Memcached | 与"轻量无数据库依赖"的设计目标冲突 |
| GUID 服务端追踪（Ookla 方案） | 需要服务端实时接收测量数据，架构改动过大，不适合轻量项目 |

### 5.4 推荐方案实施优先级

```
优先级 1（立即）-> Referer/Origin 校验       [5 分钟, report.php 加几行]
优先级 2（立即）-> Apache mod_evasive 限流    [Dockerfile 改动]
优先级 3（短期）-> Token + 时间窗口校验       [新增 token.php + 改前端 + 改 report.php]
优先级 4（可选）-> Cloudflare Turnstile      [需注册外部服务]
```

---

## 6. 参考来源汇总

| 来源 | URL | 用途 |
|------|-----|------|
| LibreSpeed telemetry.php 源码 | https://github.com/librespeed/speedtest/blob/3ada090eefc2443994f9f4a27c2b925cba0f5cfa/results/telemetry.php | 对比原项目实现 |
| LibreSpeed telemetry_settings.php | https://github.com/librespeed/speedtest/blob/3ada090eefc2443994f9f4a27c2b925cba0f5cfa/results/telemetry_settings.php | 原项目配置选项 |
| LibreSpeed telemetry_db.php | https://github.com/librespeed/speedtest/blob/3ada090eefc2443994f9f4a27c2b925cba0f5cfa/results/telemetry_db.php | 原项目数据库层 |
| LibreSpeed 安全公告 GHSA-3954-xrwh-fq4q | https://github.com/librespeed/speedtest/security/advisories/GHSA-3954-xrwh-fq4q | 已披露的 curl 伪造 PoC |
| CVE-2024-32890 | https://nvd.nist.gov/vuln/detail/CVE-2024-32890 | LibreSpeed 漏洞记录 |
| Hack_Speedtest_Ookla | https://github.com/shakilofficial0/Hack_Speedtest_Ookla | Ookla 防护分析 + GUID 方案 |
| Cloudflare speedtest | https://github.com/cloudflare/speedtest | Cloudflare 测速架构参考 |
| OWASP CSRF Prevention Cheat Sheet | https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html | CSRF/HMAC/token 最佳实践 |
| EverBytes: HMAC Signatures | https://everbytes.dazzbytes.com/php/hardening-php-webhooks-preventing-spoofing-with-hmac-signatures | PHP HMAC 实践 |
| techearl.com: PHP endpoint HMAC | https://techearl.com/wordpress-secure-rest-api-write-endpoint | HMAC + 时间戳 + nonce 完整方案 |
| NGINX Blog: Rate Limiting | https://blog.nginx.org/blog/rate-limiting-nginx | Nginx 速率限制官方文档 |
| getpagespeed.com: NGINX Rate Limiting 2026 | https://www.getpagespeed.com/server-setup/nginx/nginx-rate-limiting | 2026 年完整指南 |
| khalil-shreateh.com: PHP AJAX security | https://khalil-shreateh.com/khalil.shtml/it-highlights/awareness-and-security/45190-securing-a-php-endpoint-called-via-ajax-direct-access-csrf-and-rate-limiting.html | PHP session + CSRF + 限流 |
| Stack Overflow: Block curl POST | https://stackoverflow.com/questions/62644315/php-block-a-client-to-use-curl-to-send-post-requests-to-my-website | 社区讨论 Referer/CSRF/Captcha |
| Fastly Blog: UA Spoofing | https://www.fastly.com/blog/ua-spoofing-101-detection-defense-with-fastlys-next-gen-waf | TLS 指纹/行为分析 |
| 本项目 report.php | https://github.com/gregPerlinLi/gdutnic-speedtest-x/blob/1646822edccb632c6b02f80468853ecc29238284/backend/report.php | 漏洞确认 |
| speedtest-x (BadApple9) report.php | https://github.com/BadApple9/speedtest-x/blob/dd8bbe1080cdfb960307540cff47e76080e4083e/backend/report.php | Fork 对比 |
