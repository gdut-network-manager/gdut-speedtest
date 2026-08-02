# 前端 IPv4/IPv6 协议支持检测技术研究

> **研究目标**：在纯前端 JavaScript 中检测用户浏览器/网络是否支持 IPv4 和 IPv6，
> 以便在测速站点选择器中对不支持的协议按钮进行灰显处理（如"当前网络不支持 IPv6"）。
>
> **项目背景**：gdutnic-speedtest-x（LibreSpeed 分支），部署于广东工业大学。
> 已有 IPv4 专用域名 `speed4.gdut.edu.cn`、IPv6 专用域名 `speed6.gdut.edu.cn`、
> 双栈域名 `speed.gdut.edu.cn`，以及 PHP 后端 `backend/getIP.php`。
>
> **文档性质**：仅研究文档，不含实现代码。所有代码片段为 API 调用参考示例。

---

## 目录

1. [核心问题：为什么不能直接用双栈域名检测](#1-核心问题为什么不能直接用双栈域名检测)
2. [技术一：`fetch()` + `no-cors` 模式探测 AAAA-only 端点（推荐）](#2-技术一fetch--no-cors-模式探测-aaaa-only-端点推荐)
3. [技术二：`Image` 对象加载探测](#3-技术二image-对象加载探测)
4. [技术三：WebRTC ICE 候选地址枚举](#4-技术三webrtc-ice-候选地址枚举)
5. [技术四：DNS 解析时序推断](#5-技术四dns-解析时序推断)
6. [技术五：XMLHttpRequest 探测](#6-技术五xmlhttprequest-探测)
7. [横向关注点：CORS、混合内容、超时、误判](#7-横向关注点cors混合内容超时误判)
8. [针对 gdutnic-speedtest-x 的推荐方案](#8-针对-gdutnic-speedtest-x-的推荐方案)
9. [主要参考来源索引](#9-主要参考来源索引)

---

## 1. 核心问题：为什么不能直接用双栈域名检测

在深入各项技术之前，必须理解一个根本性约束：**不能通过双栈域名（同时有 A 和 AAAA 记录）来检测用户是否支持 IPv6**。

### 原因：Happy Eyeballs 算法

现代浏览器（Chrome、Firefox、Safari）实现了 **Happy Eyeballs** 算法（RFC 6555 / RFC 8305）。当连接一个同时有 IPv4（A 记录）和 IPv6（AAAA 记录）地址的双栈主机时，浏览器会同时尝试两种协议的连接，优先使用 IPv6，如果 IPv6 在短时间内（Chrome/Firefox 约 300ms）未完成连接，则回退到 IPv4。

> **RFC 6555 §6（示例算法）**：
> "1. 调用 getaddrinfo()，返回按主机地址偏好策略排序的 IP 地址列表。
>  2. 用列表中的第一个地址（如 IPv6）发起连接尝试。
>  3. 如果该连接在短时间内未完成（Firefox 和 Chrome 使用 300ms），
>     则用另一个地址族（如 IPv4）的第一个地址发起连接尝试。
>  4. 第一个建立的连接被使用，另一个连接被丢弃。"
>
> — [RFC 6555](https://www.rfc-editor.org/rfc/rfc6555.html#section-6)

这意味着：即使用户的 IPv6 完全不可用，浏览器在访问双栈域名时也会在 ~300ms 内回退到 IPv4 并成功连接。从前端 JavaScript 的视角，`fetch()` 会正常 resolve——你无法区分"通过 IPv4 连接成功"和"通过 IPv6 连接成功"。

### 结论

要可靠地检测 IPv6 支持性，**必须使用只有 AAAA 记录（无 A 记录）的域名**，强制浏览器只能走 IPv6。同理，检测 IPv4 支持性需使用只有 A 记录的域名。

> **test-ipv6.com 的说明**：
> "Test with IPv6 DNS record — Fetches an object that has just an AAAA record in DNS.
>  This is expected to use IPv6. Users not yet on the IPv6 Internet are likely to see this fail."
>
> — [test-ipv6.com](https://test-ipv6.com/)

本项目已具备此条件：`speed6.gdut.edu.cn`（AAAA-only）和 `speed4.gdut.edu.cn`（A-only）。

---

## 2. 技术一：`fetch()` + `no-cors` 模式探测 AAAA-only 端点（推荐）

### 工作原理

使用 `fetch()` 向 AAAA-only 域名上的任意 HTTPS 端点发起请求，设置 `mode: "no-cors"` 以绕过 CORS 检查，并用 `AbortSignal.timeout()` 设置超时：

- **fetch promise resolve（返回 opaque 响应）** → TCP+TLS 连接成功 → **该协议可用**
- **fetch promise reject（TypeError）** → 网络错误（连接失败、DNS 失败、无路由等）→ **该协议不可用**
- **fetch promise reject（TimeoutError）** → 超时 → **该协议不可用或网络质量差**

### 关键 API 行为

#### `no-cors` 模式

`mode: "no-cors"` 使跨域请求**不需要服务器返回 CORS 响应头**即可完成连接。响应为 **opaque**（`status` 为 `0`，`body` 为 `null`，`headers` 为空），但**连接本身仍然发生**——这正是我们需要的：只关心能否连上，不关心响应内容。

> **MDN 文档**：
> "Setting `mode` to `no-cors` disables CORS for cross-origin requests, restricting headers
>  and methods (GET, HEAD, and POST). The response is *opaque*, meaning its headers and body
>  are not available to JavaScript."
>
> — [MDN: Using Fetch — Making cross-origin requests](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#making_cross-origin_requests)

```javascript
// 参考：no-cors 模式返回 opaque 响应
const response = await fetch("https://speed6.gdut.edu.cn/backend/empty.php", {
  mode: "no-cors",
});
console.log(response.type);   // "opaque"
console.log(response.status); // 0
console.log(response.body);   // null
```
> 来源：[MDN: Response.type — An opaque response](https://developer.mozilla.org/en-US/docs/Web/API/Response/type)

#### 网络错误导致 reject

> **MDN 文档**：
> "A `fetch()` promise will reject with a `TypeError` when a network error is encountered,
>  although this usually means permission issues or similar."
>
> — [MDN: Using Fetch — Checking that the fetch was successful](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#checking_that_the_fetch_was_successful)

当用户无 IPv6 路由时，DNS 仍然可以解析出 AAAA 记录（DNS 解析走 IPv4/IPv6 均可），但 TCP 连接到 IPv6 地址会失败（操作系统返回 `EHOSTUNREACH` / `ENETUNREACH`），浏览器将其映射为网络错误，`fetch()` reject。

#### 超时控制：`AbortSignal.timeout()`

`fetch()` 没有内建超时机制，必须通过 `AbortSignal` 实现：

```javascript
// 参考：5 秒超时
try {
  const res = await fetch(url, {
    mode: "no-cors",
    signal: AbortSignal.timeout(5000),
  });
  // 连接成功 → 协议可用
} catch (err) {
  if (err.name === "TimeoutError") {
    // 超时 → 协议不可用或网络差
  } else if (err.name === "AbortError") {
    // 手动取消
  } else {
    // TypeError → 网络错误，协议不可用
  }
}
```
> 来源：[MDN: AbortSignal — Aborting a fetch operation with a timeout](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal#aborting_a_fetch_operation_with_a_timeout)

`AbortSignal.timeout()` 浏览器兼容性：Chrome 103+（2022.06）、Firefox 100+（2022.05）、Safari 16.0+（2022.09）。对于旧浏览器，回退方案为 `setTimeout(() => controller.abort(), ms)`。

### 优缺点

| 维度 | 评价 |
|------|------|
| **可靠性** | ✅ 高。连接成功 → resolve；连接失败 → reject。语义清晰 |
| **CORS** | ✅ `no-cors` 模式完全绕过 CORS，服务器无需配置任何 CORS 头 |
| **响应内容** | ✅ 不关心。opaque 响应即可判断连通性 |
| **混合内容** | ⚠️ HTTPS 页面只能 fetch HTTPS 资源（fetch 属于"可阻止的混合内容"）。端点必须支持 HTTPS 且证书有效 |
| **超时** | ✅ 可通过 `AbortSignal.timeout()` 精确控制 |
| **区分"不支持" vs "超时"** | ⚠️ 可通过错误类型部分区分：TypeError 通常为快速失败（无路由），TimeoutError 为超时。但非 100% 可靠 |
| **浏览器兼容** | ✅ `fetch()` 广泛支持（所有现代浏览器）。`AbortSignal.timeout()` 需 2022+ 浏览器，旧浏览器可用 `AbortController` + `setTimeout` 回退 |
| **实现复杂度** | ✅ 低。几行代码 |

---

## 3. 技术二：`Image` 对象加载探测

### 工作原理

创建 `Image` 对象，设置 `onload` / `onerror` 回调，将 `src` 指向 AAAA-only 域名上的图片资源：

- **`onload` 触发** → 连接成功且响应为有效图片 → **协议可用**
- **`onerror` 触发** → 连接失败，或响应非图片格式 → **协议可能不可用**（存在歧义）

```javascript
// 参考：Image 加载探测
var img = new Image();
img.onload  = function() { /* IPv6 可用 */ };
img.onerror = function() { /* IPv6 不可用 或 端点未返回图片 */ };
// 缓存破坏参数防止浏览器用缓存判定
img.src = "https://speed6.gdut.edu.cn/favicon.ico?r=" + Math.random();
```

### 为什么图片加载不受 CORS 限制

`<img>` 元素加载跨域图片时，浏览器**不强制 CORS 检查**（对于 `onload`/`onerror` 事件而言）。图片属于"可升级的混合内容"（upgradable content），浏览器会自动将 HTTP 升级为 HTTPS。

> **MDN 文档（Mixed Content）**：
> "Upgradable content requests are those where an insecure request will automatically be
>  upgraded to a secure request... The following elements are upgradable: `<img>` where
>  origin is set via `src` attribute..."
>
> — [MDN: Mixed content — Upgradable content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content#upgradable_content)

ipv6.army 网站确认了这一实践：

> "All tests use image loading techniques to avoid CORS restrictions and measure actual
>  connection times."
>
> — [ipv6.army](https://ipv6.army/)

### 优缺点

| 维度 | 评价 |
|------|------|
| **可靠性** | ⚠️ 中。`onerror` 有歧义：连接失败和"响应非图片"都会触发 `onerror` |
| **CORS** | ✅ 图片加载不受 CORS 限制（仅就 `onload`/`onerror` 而言） |
| **端点要求** | ⚠️ 端点必须返回有效图片数据（如 favicon.ico、1x1 透明 PNG）。如果端点返回 JSON/HTML/空内容，`onerror` 会触发 |
| **混合内容** | ✅ 图片属于"可升级内容"，HTTP→HTTPS 自动升级。但**注意**：如果 URL 的 host 是 IP 地址而非域名，则不升级而是直接阻止 |
| **超时** | ⚠️ `Image` 没有内建超时。需用 `setTimeout` 手动判定：超时后检查是否已 `onload`，若未加载则视为不可用 |
| **浏览器兼容** | ✅ 所有浏览器 |
| **实现复杂度** | ✅ 低，但超时处理增加复杂度 |

### 与技术一对比

`Image` 方式的主要劣势是 `onerror` 的歧义性和缺少内建超时。`fetch` + `no-cors` 在语义清晰度和超时控制上均优于 `Image`。`Image` 方式的唯一优势是更旧的浏览器兼容性（但在 2026 年这已不重要）。

---

## 4. 技术三：WebRTC ICE 候选地址枚举

### 工作原理

创建 `RTCPeerConnection`，添加 `DataChannel`，生成 `SDP offer` 并设置本地描述，监听 `onicecandidate` 事件。ICE 候选字符串中包含本地 IP 地址，可解析出 IPv4/IPv6 地址来判断本地接口的协议支持。

ICE 候选字符串格式：

```
a=candidate:4234997325 1 udp 2043278322 192.0.2.172 44323 typ host
```
> 来源：[MDN: RTCIceCandidate.candidate — SDP Candidate String Format](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate/candidate)

```javascript
// 参考：WebRTC ICE 候选枚举
var pc = new RTCPeerConnection({
  iceServers: [] // 不使用 STUN 服务器，只收集 host 候选
});
pc.createDataChannel("test");
pc.onicecandidate = function(e) {
  if (!e.candidate) {
    // 收集完成
    return;
  }
  var candidate = e.candidate.candidate;
  // 解析候选字符串中的地址
  // 如果包含 "." → 可能是 IPv4
  // 如果包含 ":" → 可能是 IPv6
};
pc.createOffer().then(function(offer) {
  return pc.setLocalDescription(offer);
});
```
> 来源：[MDN: RTCPeerConnection.onicecandidate](https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/icecandidate_event)

### 致命限制：mDNS 主机名混淆（Chrome 76+ / Firefox / Safari）

**此技术在现代浏览器中基本不可靠。** 从 Chrome 76（2019 年 8 月）起，Chrome 将 ICE host 候选中的私有 IP 地址替换为动态生成的 mDNS 主机名（如 `1f4712db-ea17-4bcf-a596-105139dfd8bf.local`），以防止通过 WebRTC 进行用户指纹追踪。Firefox 和 Safari 也实现了类似机制。

> **Chrome 官方公告**：
> "When the feature is active, private IP addresses in ICE host candidates will be replaced
>  by an mDNS hostname, e.g., `1f4712db-ea17-4bcf-a596-105139dfd8bf.local`. Currently, this
>  feature is active for all sites **except those that have getUserMedia permissions**."
>
> — [Chrome PSA: Private IP addresses exposed by WebRTC changing to mDNS hostnames](https://groups.google.com/a/chromium.org/g/blink-dev/c/z5hSy6Rf_aE)

> **IETF 草案（draft-ietf-rtcweb-mdns-ice-candidates）**：
> "For each host candidate gathered by an ICE agent... the candidate is handled as follows:
>  1. Check whether this IP address satisfies the ICE agent's policy regarding whether an
>     address is safe to expose. If so, expose the candidate and abort this process.
>  3. Generate a unique mDNS hostname. The unique name MUST consist of a version 4 UUID
>     as defined in [RFC4122], followed by `.local`.
>  7. Replace the IP address of the ICE candidate with its mDNS hostname and provide the
>     candidate to the web application."
>
> — [draft-ietf-rtcweb-mdns-ice-candidates §3.1.1](https://datatracker.ietf.org/doc/html/draft-ietf-rtcweb-mdns-ice-candidates-03#section-3.1.1)

这意味着在大多数现代浏览器中，JavaScript 代码看到的候选地址不是真实的 IP 地址，而是 `.local` 后缀的 mDNS 主机名。你**无法**从 mDNS 主机名判断它是 IPv4 还是 IPv6 地址。

**例外情况**（mDNS 混淆不生效时）：
- 页面已获得 `getUserMedia`（摄像头/麦克风）权限的站点（Chrome）
- Chrome on Android（未内建 mDNS 栈，发送原始 IP）
- 某些禁用了该功能的企业环境

但这些例外在生产环境中不可依赖。

### 优缺点

| 维度 | 评价 |
|------|------|
| **可靠性** | ❌ 低。mDNS 混淆使现代浏览器中无法获取真实本地 IP |
| **检测目标** | ⚠️ 检测的是**本地接口是否有 IPv6 地址**，而非**IPv6 路由是否可达**。有本地 IPv6 地址不等于能访问 IPv6 互联网 |
| **服务器需求** | ✅ 无需服务器端组件 |
| **隐私** | ❌ 涉及收集用户本地网络信息，有隐私争议 |
| **复杂度** | ❌ 高。需要理解 ICE/SDP/WebRTC 协议栈 |
| **浏览器兼容** | ⚠️ WebRTC API 广泛支持，但 mDNS 混淆行为因浏览器而异 |
| **推荐度** | ❌ 不推荐用于此场景 |

---

## 5. 技术四：DNS 解析时序推断

### 工作原理

理论上，可以通过测量 `fetch()` 或 `Image()` 加载的耗时来推断 DNS 解析行为：如果 AAAA 查询快速返回 NXDOMAIN（域名不存在），说明该域名无 IPv6 地址；如果 AAAA 查询超时，可能说明 DNS 服务器不支持 IPv6。

### 为什么不实用

1. **浏览器不暴露 DNS 解析细节**：JavaScript 无法直接发起 DNS 查询或获取 DNS 解析结果。`fetch()` 的计时是端到端的（DNS + TCP + TLS + HTTP），无法单独提取 DNS 阶段。

2. **Performance API 的局限**：`PerformanceResourceTiming` 提供 `domainLookupStart` 和 `domainLookupEnd`，但这些时间点包含了 A + AAAA 查询的总和，无法区分。且这些 API 主要用于同源资源分析。

3. **无法区分协议**：即使知道 DNS 解析耗时，也无法从中推断用户是否支持 IPv6——DNS 解析走 IPv4 或 IPv6 UDP 均可，与用户的 IPv6 路由能力无直接关系。

> **结论**：此技术不可行，不推荐。

---

## 6. 技术五：XMLHttpRequest 探测

### 工作原理

使用 `XMLHttpRequest` 向 AAAA-only 端点发起请求，通过 `onload`/`onerror` 判断连通性。

### 与 `fetch()` 的关键差异

`XMLHttpRequest` **没有 `no-cors` 模式**。对于跨域请求，XHR 始终执行 CORS 检查——如果服务器不返回正确的 `Access-Control-Allow-Origin` 头，`onerror` 会触发，即使 TCP 连接已经成功。

> **MDN 文档（Mixed Content）**：
> `XMLHttpRequest` 请求属于"可阻止的混合内容"（blockable content），从 HTTPS 页面发起
> HTTP 请求会被浏览器阻止。
>
> — [MDN: Mixed content — Blockable content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content#blockable_content)

这意味着：
- 要用 XHR 探测 `speed6.gdut.edu.cn`（跨域），服务器**必须**返回 CORS 头（如 `Access-Control-Allow-Origin: *`）
- 如果不配置 CORS 头，XHR 的 `onerror` 无法区分"连接失败"和"CORS 检查失败"

本项目当前的 `getIP.php` 探测逻辑（`index.html` 第 494-500 行）使用的是 `fetch('./backend/getIP.php')`，这是**同源**请求，所以没有 CORS 问题。但探测另一个子域名就是跨域了。

### 优缺点

| 维度 | 评价 |
|------|------|
| **CORS** | ❌ 必须服务器配置 CORS 头，否则无法区分连接失败和 CORS 失败 |
| **超时** | ✅ XHR 有内建 `timeout` 属性和 `ontimeout` 事件 |
| **浏览器兼容** | ✅ 所有浏览器 |
| **推荐度** | ❌ 不推荐。`fetch` + `no-cors` 在所有方面优于 XHR |

---

## 7. 横向关注点：CORS、混合内容、超时、误判

### 7.1 CORS 问题

**问题**：从 `speed.gdut.edu.cn` 页面探测 `speed6.gdut.edu.cn` 是跨域请求。

**解决方案**：使用 `fetch()` 的 `mode: "no-cors"`。此模式下：
- 请求会被发送（TCP 连接建立）
- 服务器**不需要**返回任何 CORS 响应头
- 响应为 opaque（`status: 0`，`body: null`），但 promise **resolve**
- 仅当**连接本身失败**时 promise 才 reject

> **MDN 文档**：
> "`no-cors` is mainly for certain service worker use cases... The response will be opaque:
>  its status is 0, its headers are empty, and its body is not readable by JavaScript."
>
> — [MDN: CORS errors — Use `no-cors` mode for opaque responses](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors#use_no-cors_mode_for_opaque_responses)

### 7.2 混合内容限制

**问题**：如果当前页面是 HTTPS，则不能 fetch HTTP 资源。

**规则**（来自 [MDN: Mixed content](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content)）：

| 资源类型 | HTTPS 页面请求 HTTP 资源 | 行为 |
|----------|--------------------------|------|
| `fetch()` / `XMLHttpRequest` | ❌ 阻止 | Blockable content |
| `<script>` / `<link>` / `<iframe>` | ❌ 阻止 | Blockable content |
| `<img src="http://域名">` | ⚠️ 自动升级为 HTTPS | Upgradable content |
| `<img src="http://IP地址">` | ❌ 阻止 | IP 地址主机不升级 |

**对本项目的影响**：`speed4.gdut.edu.cn`、`speed6.gdut.edu.cn`、`speed.gdut.edu.cn` 均需通过 HTTPS 提供服务，且 TLS 证书需有效。从 HTTPS 页面 fetch HTTPS 端点不存在混合内容问题。

### 7.3 超时处理

**问题**：当用户有 IPv6 地址但路由损坏时（如 6to4 隧道失效），TCP SYN 发出后无响应，浏览器可能等待 75 秒以上才放弃。

**解决方案**：使用 `AbortSignal.timeout(ms)` 设置超时。

> **RFC 6555 §3.2**：
> "It can take towards 75+ seconds [for] the browser [to] give up!"
>
> — [test-ipv6.com FAQ 引用 RFC 6555](http://osaka.test-ipv6.com/faq.html)

**推荐超时时间**：5-8 秒。

理由：
- 正常 IPv6 连接应在 1-2 秒内完成（含 DNS + TCP + TLS）
- RFC 8305 建议 Happy Eyeballs 的"最大连接尝试延迟"为 2 秒
- 留足余量避免因网络延迟导致的误判
- 5-8 秒足以区分"快速失败"（无路由）和"超时失败"（路由损坏）

```javascript
// 参考：超时回退方案（兼容旧浏览器）
function fetchWithTimeout(url, ms) {
  if (typeof AbortSignal.timeout === 'function') {
    // 现代浏览器（Chrome 103+, Firefox 100+, Safari 16+）
    return fetch(url, { mode: "no-cors", signal: AbortSignal.timeout(ms) });
  } else {
    // 旧浏览器回退
    var controller = new AbortController();
    setTimeout(function() { controller.abort(); }, ms);
    return fetch(url, { mode: "no-cors", signal: controller.signal });
  }
}
```

### 7.4 误判（假阴性）

**问题**：用户实际支持 IPv6，但探测端点临时不可用（服务器宕机、网络抖动），导致探测失败。

**影响**：IPv6 按钮被错误灰显，用户无法切换到 IPv6 测速。

**缓解措施**：
1. 使用自身可靠的基础设施端点（如 `backend/empty.php`），而非第三方服务
2. 可考虑多次重试（如 2 次探测，任一成功即视为可用）
3. 提供"强制切换"的逃生通道（如灰显按钮仍可点击，点击后尝试跳转，失败再提示）

### 7.5 能否区分"不支持 IPv6"与"IPv6 超时"

**部分可以**，通过错误类型：

| 错误类型 | `err.name` | 含义 | 典型场景 |
|----------|-----------|------|---------|
| TypeError | `"TypeError"` | 网络错误 | 无 IPv6 路由，连接立即被拒 |
| TimeoutError | `"TimeoutError"` | 超时 | 有 IPv6 路由但损坏，SYN 无响应 |
| AbortError | `"AbortError"` | 手动取消 | 用户操作触发的取消 |

但此区分**非 100% 可靠**：某些网络环境下"无路由"也可能表现为超时（如防火墙静默丢弃 IPv6 包），而"路由损坏"也可能快速返回 ICMP 错误。

> 来源：[MDN: AbortSignal — Aborting a fetch with timeout or explicit abort](https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal#aborting_a_fetch_with_timeout_or_explicit_abort)

---

## 8. 针对 gdutnic-speedtest-x 的推荐方案

### 8.1 推荐技术

**技术一：`fetch()` + `no-cors` 模式**，利用项目现有的域名基础设施。

### 8.2 推荐探测端点

| 协议 | 探测 URL | 说明 |
|------|---------|------|
| IPv6 | `https://speed6.gdut.edu.cn/backend/empty.php?r={random}` | AAAA-only 域名，强制 IPv6 |
| IPv4 | `https://speed4.gdut.edu.cn/backend/empty.php?r={random}` | A-only 域名，强制 IPv4 |

选择 `backend/empty.php` 的理由：
- 项目已有此文件（README 项目结构中列出："empty.php — 下载测速空数据"）
- `no-cors` 模式不关心响应内容，空响应完全可行
- 添加 `?r={random}` 缓存破坏参数，防止浏览器使用缓存的 opaque 响应

### 8.3 探测策略优化

当前页面已能通过 hostname 和 `getIP.php` 判断用户**当前**使用的协议（`index.html` 第 487-501 行）。优化策略：**只探测用户当前未使用的协议**。

| 当前域名 | 已知 | 需探测 |
|---------|------|-------|
| `speed4.gdut.edu.cn` | IPv4 ✅ | IPv6 |
| `speed6.gdut.edu.cn` | IPv6 ✅ | IPv4 |
| `speed.gdut.edu.cn` | 通过 `getIP.php` 判断 | 对端协议 |

这样每次只需一次探测，减少不必要的网络请求。

### 8.4 参考流程（非实现代码）

```
页面加载
  ├─ 判断当前域名
  │   ├─ speed4 → IPv4 确认可用，探测 IPv6
  │   ├─ speed6 → IPv6 确认可用，探测 IPv4
  │   └─ speed  → 调用 getIP.php 确认当前协议，探测对端
  │
  ├─ 执行探测：fetch(对端URL, {mode:"no-cors", signal:AbortSignal.timeout(6000)})
  │   ├─ resolve → 对端协议可用，保持按钮可点击
  │   └─ reject  → 对端协议不可用，灰显按钮 + tooltip "当前网络不支持 IPv6/IPv4"
  │
  └─ 更新 UI
```

### 8.5 UI 集成参考

当前 IPv4/IPv6 按钮结构（`index.html` 第 250-251 行）：

```html
<a href="https://speed4.gdut.edu.cn" id="btn-ipv4" class="ip-btn ...">IPv4</a>
<a href="https://speed6.gdut.edu.cn" id="btn-ipv6" class="ip-btn ...">IPv6</a>
```

灰显状态可通过 Tailwind CSS 类实现：
- 添加 `opacity-40 pointer-events-none cursor-not-allowed` 使按钮灰显且不可点击
- 添加 `title="当前网络不支持 IPv6"` 属性提供 tooltip
- 或使用 `group relative` + 悬浮提示气泡（与现有"用网教程"二维码悬浮提示风格一致）

### 8.6 边界情况处理

| 场景 | 处理方式 |
|------|---------|
| `fetch()` 不支持的旧浏览器 | 跳过探测，按钮保持默认可点击状态（优雅降级） |
| `AbortSignal.timeout()` 不支持 | 回退为 `AbortController` + `setTimeout` |
| 探测端点 TLS 证书无效 | fetch reject，按钮灰显（这是正确行为：连不上就是不可用） |
| 用户在 `speed6` 上但 IPv6 探测失败 | 不应发生（页面能加载说明 IPv6 可用），但若发生则灰显 IPv4 |
| 用户使用代理/VPN | 探测结果反映代理网络的协议支持，与用户真实网络可能不同。这是预期行为 |
| NAT64/DNS64 环境 | 用户可能通过 NAT64 访问 AAAA-only 域名（DNS64 将 AAAA 合成为 IPv4 地址）。探测可能误判为 IPv6 可用，但实际走的是 IPv4。这是已知局限，影响较小 |

---

## 9. 主要参考来源索引

### 规范与标准

| 来源 | 链接 | 引用内容 |
|------|------|---------|
| RFC 6555 — Happy Eyeballs v1 | <https://www.rfc-editor.org/rfc/rfc6555.html> | 双栈连接回退算法、300ms 超时、10 分钟缓存 |
| RFC 8305 — Happy Eyeballs v2 | <https://www.rfc-editor.org/rfc/rfc8305.html> | Resolution Delay 50ms、Connection Attempt Delay 250ms、Max 2s |
| IETF draft-ietf-rtcweb-mdns-ice-candidates | <https://datatracker.ietf.org/doc/html/draft-ietf-rtcweb-mdns-ice-candidates-03> | mDNS 主机名替换私有 IP 的算法（§3.1.1） |
| WHATWG Fetch Living Standard | <https://fetch.spec.whatwg.org/> | Fetch API、CORS 协议、no-cors 模式、opaque 响应 |
| W3C Mixed Content | <https://w3c.github.io/webappsec-mixed-content/> | 混合内容分类（upgradable / blockable） |

### MDN Web Docs

| 页面 | 链接 | 引用内容 |
|------|------|---------|
| Using Fetch — Cross-origin requests | <https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#making_cross-origin_requests> | `no-cors` 模式说明、opaque 响应 |
| Response.type — Opaque response | <https://developer.mozilla.org/en-US/docs/Web/API/Response/type> | opaque 响应示例（status 0, body null） |
| CORS errors — no-cors mode | <https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors#use_no-cors_mode_for_opaque_responses> | no-cors 用于不需要读取响应的场景 |
| Mixed content | <https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Mixed_content> | upgradable vs blockable、fetch/XHR 属于 blockable、img 属于 upgradable |
| AbortSignal | <https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal> | `AbortSignal.timeout()`、`AbortSignal.any()`、错误类型区分 |
| RTCPeerConnection: icecandidate event | <https://developer.mozilla.org/en-US/docs/Web/API/RTCPeerConnection/icecandidate_event> | `onicecandidate` 事件处理、候选收集完成判定 |
| RTCIceCandidate.candidate | <https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidate/candidate> | ICE 候选字符串格式 |

### 浏览器厂商文档

| 来源 | 链接 | 引用内容 |
|------|------|---------|
| Chrome PSA: WebRTC mDNS | <https://groups.google.com/a/chromium.org/g/blink-dev/c/z5hSy6Rf_aE> | Chrome 76+ 用 mDNS 主机名替换私有 IP、getUserMedia 例外 |
| Chrome discuss-webrtc: mDNS | <https://groups.google.com/g/discuss-webrtc/c/6stQXi72BEU> | mDNS 特性详情、Chrome Android 无 mDNS 栈 |

### 真实项目参考

| 项目 | 链接 | 实践 |
|------|------|------|
| test-ipv6.com (falling-sky) | <https://test-ipv6.com/> | 使用 AJAX 请求 AAAA-only/A-only/双栈域名，通过 pass/fail + 耗时判定 |
| 6connect/ipv6-website-stats | <https://github.com/6connect/ipv6-website-stats> | `fetch()` AAAA-only 域名，catch 失败后回退到双栈域名 |
| ipv6.army | <https://ipv6.army/> | 使用 Image 加载技术避免 CORS 限制，测量连接时间 |
| Google ipv6test | <https://ipv6test.google.com/> | Google 的 IPv4/IPv6 专用子域名（ipv4.google.com, ipv6.google.com） |

### 本项目相关代码

| 文件 | 位置 | 说明 |
|------|------|------|
| `index.html` | 第 470-502 行 | 当前 IP 协议检测逻辑（hostname + getIP.php） |
| `index.html` | 第 250-251 行 | IPv4/IPv6 按钮结构（`<a>` 标签） |
| `backend/getIP.php` | 第 22-34 行 | `getClientIp()` — 通过 `$_SERVER['REMOTE_ADDR']` 等获取客户端 IP |
| `speedtest_worker.js` | 第 293-317 行 | `getIp()` — 前端通过 XHR 调用 `url_getIp` 获取 IP |

---

## 总结

| 技术 | 可靠性 | CORS | 超时控制 | 推荐 |
|------|--------|------|---------|------|
| **fetch + no-cors** | ✅ 高 | ✅ 绕过 | ✅ AbortSignal.timeout | ✅ **推荐** |
| Image 加载 | ⚠️ 中 | ✅ 不受限 | ⚠️ 需手动 | 可选备选 |
| WebRTC ICE | ❌ 低 | N/A | N/A | ❌ 不推荐（mDNS 混淆） |
| DNS 时序推断 | ❌ 不可行 | N/A | N/A | ❌ 不推荐 |
| XMLHttpRequest | ⚠️ 中 | ❌ 需配置 | ✅ 内建 | ❌ 不推荐 |

**最终推荐**：使用 `fetch()` + `mode: "no-cors"` + `AbortSignal.timeout(6000)` 探测
`https://speed6.gdut.edu.cn/backend/empty.php`（检测 IPv6）和
`https://speed4.gdut.edu.cn/backend/empty.php`（检测 IPv4）。
利用现有域名架构，无需修改后端，无需 CORS 配置，代码量极小。
