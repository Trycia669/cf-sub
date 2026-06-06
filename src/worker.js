const SUBUpdateTime = 6;

const DEFAULT_SUBAPI = "subapi.cmliussss.net";
const DEFAULT_SUBCONFIG = "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Mini_MultiMode.ini";

const DEFAULT_ADD = [
  "3Q.bestip-one.cf.090227.xyz"
];

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const pathname = url.pathname;

      const FileName = env.SUBNAME || "SUB";
      const EndPS = env.PS || "";

      let subProtocol = "https";
      let subConverter = env.SUBAPI || DEFAULT_SUBAPI;

      if (subConverter.includes("http://")) {
        subProtocol = "http";
        subConverter = subConverter.split("//")[1];
      } else if (subConverter.includes("https://")) {
        subProtocol = "https";
        subConverter = subConverter.split("//")[1];
      }

      const subConfig = env.SUBCONFIG || DEFAULT_SUBCONFIG;

      const UA = request.headers.get("User-Agent") || "";
      const userAgent = UA.toLowerCase();

      if (pathname === "/") {
        return htmlResponse(getHomePage(url.origin, FileName));
      }

      if (pathname === "/sub") {
        return await handleSub(request, env, {
          url,
          FileName,
          EndPS,
          subProtocol,
          subConverter,
          subConfig,
          userAgent
        });
      }

      if (pathname === "/short") {
        return await handleShort(url);
      }

      if (pathname === "/uuid.json") {
        return await handleUUIDJson(url, env);
      }

      if (pathname === "/subapi.json") {
        return jsonResponse([
          {
            label: "默认后端",
            value: `${subProtocol}://${subConverter}`
          },
          {
            label: "CM 负载均衡后端",
            value: "https://subapi.fxxk.dedyn.io"
          },
          {
            label: "周润发后端",
            value: "https://subapi.zrfme.com"
          },
          {
            label: "肥羊增强后端",
            value: "https://url.v1.mk"
          },
          {
            label: "肥羊备用后端",
            value: "https://sub.d1.mk"
          }
        ]);
      }

      if (pathname === "/subconfig.json") {
        return jsonResponse([
          {
            label: "默认规则",
            options: [
              {
                label: `${FileName} 默认规则`,
                value: subConfig
              }
            ]
          },
          {
            label: "ACL4SSR",
            options: [
              {
                label: "ACL4SSR Online Mini MultiMode",
                value: DEFAULT_SUBCONFIG
              },
              {
                label: "ACL4SSR Online",
                value: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online.ini"
              },
              {
                label: "ACL4SSR Online Mini",
                value: "https://raw.githubusercontent.com/ACL4SSR/ACL4SSR/master/Clash/config/ACL4SSR_Online_Mini.ini"
              }
            ]
          }
        ]);
      }

      return new Response("Not Found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });

    } catch (error) {
      return jsonResponse({
        error: "Worker Error",
        message: error.message,
        stack: error.stack
      }, 500);
    }
  }
};

async function handleShort(url) {
  const longUrl = url.searchParams.get("url");

  if (!longUrl) {
    return jsonResponse({
      error: "缺少 url 参数",
      example: "/short?url=https%3A%2F%2Fexample.com%2Fsub%3Fhost%3Dxxx"
    }, 400);
  }

  if (!/^https?:\/\//i.test(longUrl)) {
    return jsonResponse({
      error: "url 必须以 http:// 或 https:// 开头"
    }, 400);
  }

  const apiList = [
    `https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`,
    `https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`
  ];

  let lastError = "";

  for (const api of apiList) {
    try {
      const resp = await fetch(api, {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      });

      const text = await resp.text();

      if (resp.ok && /^https?:\/\//i.test(text.trim())) {
        return jsonResponse({
          longUrl,
          shortUrl: text.trim()
        });
      }

      lastError = text;
    } catch (e) {
      lastError = e.message;
    }
  }

  return jsonResponse({
    error: "短链生成失败",
    message: lastError
  }, 500);
}

async function handleSub(request, env, options) {
  const {
    url,
    FileName,
    EndPS,
    subProtocol,
    subConverter,
    subConfig,
    userAgent
  } = options;

  let hosts = [];

  if (url.searchParams.has("host")) {
    hosts = splitToArray(url.searchParams.get("host"));
  } else if (env.HOST) {
    hosts = splitToArray(env.HOST);
  }

  hosts = hosts.filter(Boolean);

  if (hosts.length === 0) {
    return jsonResponse({
      error: "缺少 host",
      message: "请在 URL 中添加 ?host=你的伪装域名，或者在环境变量 HOST 中设置"
    }, 400);
  }

  let bphost = randomItem(hosts);

  if (bphost.includes("*")) {
    bphost = bphost.replaceAll("*", Date.now().toString());
  }

  const uuidFromParam = url.searchParams.get("uuid") || env.UUID || "";
  const uuidList = await getUUIDData(bphost, uuidFromParam, env);

  if (!uuidList.length) {
    return jsonResponse({
      error: "UUID 数据为空",
      message: "请确认 host 对应的 /uuid.json 可访问，或设置环境变量 UUID"
    }, 500);
  }

  let ips = DEFAULT_ADD;

  if (env.ADD) {
    ips = splitToArray(env.ADD);
  }

  if (url.searchParams.has("ips") && url.searchParams.get("ips").trim() !== "") {
    ips = splitToArray(url.searchParams.get("ips"));
  }

  const skipCertVerify = url.searchParams.has("scv");
  const finalPath = await buildFinalPath(url, env);

  const needSubConvertUA = ["clash", "meta", "mihomo", "sing-box", "singbox"];
  const isSubConverterRequest =
    request.headers.get("subconverter-request") ||
    request.headers.get("subconverter-version") ||
    userAgent.includes("subconverter");

  const responseHeaders = {
    "Content-Type": "text/plain; charset=utf-8",
    "Profile-Update-Interval": String(SUBUpdateTime),
    "Profile-web-page-url": url.origin
  };

  if (
    needSubConvertUA.some(item => userAgent.includes(item)) &&
    !isSubConverterRequest
  ) {
    const rawUrl = url.href;
    let target = "auto";

    if (userAgent.includes("sing-box") || userAgent.includes("singbox")) {
      target = "singbox";
    } else if (
      userAgent.includes("clash") ||
      userAgent.includes("meta") ||
      userAgent.includes("mihomo")
    ) {
      target = "clash";
    }

    const convertUrl =
      `${subProtocol}://${subConverter}/sub` +
      `?target=${encodeURIComponent(target)}` +
      `&url=${encodeURIComponent(rawUrl)}` +
      `&insert=false` +
      `&config=${encodeURIComponent(subConfig)}` +
      `&emoji=true` +
      `&list=false` +
      `&tfo=false` +
      `&scv=${skipCertVerify}` +
      `&fdn=false` +
      `&sort=false` +
      `&new_name=true`;

    const resp = await fetch(convertUrl, {
      headers: {
        "User-Agent": `v2rayN/${FileName}`
      }
    });

    const text = await resp.text();

    if (!resp.ok) {
      return jsonResponse({
        error: "订阅转换失败",
        status: resp.status,
        statusText: resp.statusText,
        url: convertUrl,
        body: text.slice(0, 1000)
      }, resp.status);
    }

    responseHeaders["Content-Disposition"] =
      `attachment; filename*=utf-8''${encodeURIComponent(FileName)}`;

    return new Response(text, {
      status: 200,
      headers: responseHeaders
    });
  }

  const links = [];

  for (const rawAddress of ips) {
    const parsed = parseAddress(rawAddress);
    const selected = randomItem(uuidList);

    const uuid = selected.uuid;
    const host = selected.host || bphost;
    const name = `${parsed.name || parsed.address}${EndPS}`;

    links.push(buildVlessLink({
      uuid,
      address: parsed.address,
      port: parsed.port,
      host,
      path: finalPath,
      name,
      skipCertVerify
    }));
  }

  const body = links.join("\n");
  const isBrowser = userAgent.includes("mozilla");

  if (!isBrowser) {
    responseHeaders["Content-Disposition"] =
      `attachment; filename*=utf-8''${encodeURIComponent(FileName)}`;
  }

  return new Response(isBrowser ? body : base64Encode(body), {
    headers: responseHeaders
  });
}

async function handleUUIDJson(url, env) {
  let hosts = [];

  if (url.searchParams.has("host")) {
    hosts = splitToArray(url.searchParams.get("host"));
  } else if (env.HOST) {
    hosts = splitToArray(env.HOST);
  }

  const uuid = url.searchParams.get("uuid") || env.UUID || crypto.randomUUID();

  if (!hosts.length) {
    return jsonResponse([
      {
        uuid,
        host: url.hostname
      }
    ]);
  }

  return jsonResponse(
    hosts.map(host => ({
      uuid,
      host
    }))
  );
}

async function getUUIDData(host, uuid, env) {
  if (uuid) {
    return [
      {
        uuid,
        host
      }
    ];
  }

  try {
    const resp = await fetch(`https://${host}/uuid.json`, {
      headers: {
        "User-Agent": "CF-Workers-SUB"
      }
    });

    if (!resp.ok) {
      throw new Error(`status ${resp.status}`);
    }

    const data = await resp.json();

    if (Array.isArray(data) && data.length > 0) {
      return data
        .filter(item => item && item.uuid)
        .map(item => ({
          uuid: item.uuid,
          host: item.host || host
        }));
    }
  } catch (e) {
    // fallback
  }

  if (env.UUID) {
    return [
      {
        uuid: env.UUID,
        host
      }
    ];
  }

  return [
    {
      uuid: crypto.randomUUID(),
      host
    }
  ];
}

async function buildFinalPath(url, env) {
  const pathParam = url.searchParams.get("path") || url.searchParams.get("customPath");

  if (pathParam && pathParam.trim() !== "") {
    return pathParam.trim();
  }

  let finalPath = "/";

  const proxyip =
    url.searchParams.get("proxyip") ||
    env.PROXYIP ||
    "";

  if (proxyip.trim() !== "") {
    finalPath = `/p=${proxyip.trim()}`;
  }

  if (url.searchParams.has("socks5") && url.searchParams.get("socks5").trim() !== "") {
    const socks5 = url.searchParams.get("socks5").trim();
    const isGlobal = url.searchParams.has("global");
    finalPath = isGlobal ? `/g=${socks5}` : `/s=${socks5}`;
  }

  if (url.searchParams.has("http") && url.searchParams.get("http").trim() !== "") {
    const http = url.searchParams.get("http").trim();
    const isGlobal = url.searchParams.has("global");
    finalPath = isGlobal ? `/gh=${http}` : `/h=${http}`;
  }

  if (url.searchParams.has("ed") && url.searchParams.get("ed").trim() !== "") {
    finalPath += finalPath.includes("?")
      ? `&ed=${url.searchParams.get("ed").trim()}`
      : `?ed=${url.searchParams.get("ed").trim()}`;
  }

  return finalPath;
}

function buildVlessLink(options) {
  const {
    uuid,
    address,
    port,
    host,
    path,
    name,
    skipCertVerify
  } = options;

  const params = new URLSearchParams();

  params.set("security", "tls");
  params.set("sni", host);
  params.set("type", "ws");
  params.set("host", host);
  params.set("path", path);
  params.set("encryption", "none");
  params.set("fragment", "1,40-60,30-50,tlshello");

  if (skipCertVerify) {
    params.set("allowInsecure", "1");
  }

  return `vless://${uuid}@${address}:${port}?${params.toString()}#${encodeURIComponent(name)}`;
}

function parseAddress(input) {
  let text = String(input || "").trim();

  let name = "";
  let port = "443";
  let address = text;

  if (text.includes("#")) {
    const arr = text.split("#");
    address = arr[0];
    name = arr.slice(1).join("#");
  }

  if (address.startsWith("[") && address.includes("]")) {
    const end = address.indexOf("]");
    const ip6 = address.slice(0, end + 1);
    const rest = address.slice(end + 1);

    if (rest.startsWith(":")) {
      port = rest.slice(1) || "443";
    }

    return {
      address: ip6,
      port,
      name: name || ip6
    };
  }

  if (address.includes(":")) {
    const idx = address.lastIndexOf(":");
    const possiblePort = address.slice(idx + 1);

    if (/^\d+$/.test(possiblePort)) {
      port = possiblePort;
      address = address.slice(0, idx);
    }
  }

  return {
    address,
    port,
    name: name || address
  };
}

function splitToArray(text) {
  return String(text || "")
    .replace(/[|"'\r\n\t]+/g, ",")
    .split(",")
    .map(item => item.trim())
    .filter(Boolean);
}

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function base64Encode(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";

  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }

  return btoa(binary);
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    }
  });
}

function htmlResponse(html) {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    }
  });
}

function getHomePage(origin, FileName) {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>${escapeHtml(FileName)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
:root {
  --bg1: #020617;
  --bg2: #0f172a;
  --card: rgba(255,255,255,0.92);
  --card2: rgba(255,255,255,0.78);
  --text: #0f172a;
  --muted: #64748b;
  --blue: #2563eb;
  --blue2: #1d4ed8;
  --green: #16a34a;
  --green2: #15803d;
  --orange: #f97316;
  --border: rgba(148,163,184,0.35);
  --shadow: 0 22px 70px rgba(15,23,42,0.32);
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif;
  color: var(--text);
  background:
    radial-gradient(circle at 12% 8%, rgba(59,130,246,0.48), transparent 28%),
    radial-gradient(circle at 86% 18%, rgba(34,197,94,0.28), transparent 25%),
    radial-gradient(circle at 50% 92%, rgba(249,115,22,0.26), transparent 30%),
    linear-gradient(135deg, var(--bg1), var(--bg2));
  padding: 34px 16px;
}

.container {
  width: 100%;
  max-width: 1080px;
  margin: 0 auto;
}

.hero {
  color: #fff;
  text-align: center;
  padding: 24px 12px 34px;
}

.badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(255,255,255,0.14);
  border: 1px solid rgba(255,255,255,0.22);
  color: #e0f2fe;
  font-size: 13px;
  backdrop-filter: blur(10px);
}

.hero h1 {
  margin: 18px 0 10px;
  font-size: clamp(34px, 7vw, 58px);
  line-height: 1;
  letter-spacing: -1.8px;
}

.hero p {
  margin: 0;
  color: #cbd5e1;
  font-size: 16px;
}

.grid {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  gap: 22px;
  align-items: start;
}

@media (max-width: 900px) {
  .grid {
    grid-template-columns: 1fr;
  }
}

.card {
  background: var(--card);
  border: 1px solid rgba(255,255,255,0.62);
  border-radius: 24px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(18px);
  overflow: hidden;
}

.card-header {
  padding: 22px 24px;
  border-bottom: 1px solid var(--border);
  background: linear-gradient(180deg, rgba(255,255,255,0.76), rgba(255,255,255,0.28));
}

.card-header h2 {
  margin: 0;
  font-size: 22px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-header p {
  margin: 8px 0 0;
  color: var(--muted);
  font-size: 14px;
}

.card-body {
  padding: 24px;
}

.form-group {
  margin-bottom: 18px;
}

label.title {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 700;
  margin-bottom: 8px;
  color: #172554;
}

.hint {
  color: var(--muted);
  font-size: 12px;
  font-weight: 500;
}

input,
textarea {
  width: 100%;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: rgba(255,255,255,0.84);
  padding: 13px 14px;
  font-size: 15px;
  color: var(--text);
  outline: none;
  transition: 0.18s ease;
}

textarea {
  resize: vertical;
  min-height: 92px;
}

input:focus,
textarea:focus {
  border-color: rgba(37,99,235,0.78);
  box-shadow: 0 0 0 4px rgba(37,99,235,0.14);
  background: #fff;
}

.options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 10px 0 20px;
}

.option {
  user-select: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 13px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: rgba(255,255,255,0.72);
  color: #334155;
  font-size: 14px;
  cursor: pointer;
  transition: 0.18s ease;
}

.option:hover {
  transform: translateY(-1px);
  border-color: rgba(37,99,235,0.45);
}

.option input {
  width: auto;
  margin: 0;
  accent-color: var(--blue);
}

.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

button {
  border: 0;
  border-radius: 14px;
  padding: 12px 18px;
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  transition: 0.18s ease;
  box-shadow: 0 10px 22px rgba(37,99,235,0.22);
}

button:hover {
  transform: translateY(-2px);
}

button:active {
  transform: translateY(0);
}

.btn-primary {
  background: linear-gradient(135deg, var(--blue), #38bdf8);
}

.btn-primary:hover {
  background: linear-gradient(135deg, var(--blue2), #0284c7);
}

.btn-success {
  background: linear-gradient(135deg, var(--green), #22c55e);
  box-shadow: 0 10px 22px rgba(22,163,74,0.22);
}

.btn-success:hover {
  background: linear-gradient(135deg, var(--green2), #16a34a);
}

.btn-copy {
  margin-top: 12px;
  padding: 9px 13px;
  font-size: 13px;
  border-radius: 12px;
  background: linear-gradient(135deg, #475569, #0f172a);
  box-shadow: none;
}

.result-box {
  min-height: 62px;
  padding: 15px;
  border-radius: 16px;
  background: rgba(241,245,249,0.9);
  border: 1px dashed rgba(100,116,139,0.35);
  word-break: break-all;
  color: #334155;
  font-size: 14px;
}

.result-box a {
  color: var(--blue);
  text-decoration: none;
  font-weight: 700;
}

.result-box a:hover {
  text-decoration: underline;
}

.stack {
  display: grid;
  gap: 18px;
}

.info-card {
  background: var(--card2);
  border: 1px solid rgba(255,255,255,0.55);
  border-radius: 20px;
  padding: 20px;
  backdrop-filter: blur(16px);
  box-shadow: 0 12px 34px rgba(15,23,42,0.16);
}

.info-card h3 {
  margin: 0 0 12px;
  font-size: 18px;
  color: #172554;
}

.info-card ul {
  margin: 0;
  padding-left: 20px;
}

.info-card li {
  margin: 8px 0;
  color: #334155;
}

code {
  display: inline-block;
  max-width: 100%;
  padding: 3px 7px;
  border-radius: 8px;
  background: rgba(224,231,255,0.86);
  color: #3730a3;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  word-break: break-all;
}

.notice {
  background: linear-gradient(135deg, rgba(255,247,237,0.96), rgba(255,237,213,0.72));
  border: 1px solid rgba(249,115,22,0.22);
  border-left: 5px solid var(--orange);
  padding: 13px 14px;
  border-radius: 16px;
  color: #9a3412;
  font-size: 14px;
}

.footer {
  color: #cbd5e1;
  text-align: center;
  padding: 26px 0 8px;
  font-size: 13px;
}

.footer code {
  background: rgba(255,255,255,0.14);
  color: #e0f2fe;
}

.quick-paths {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-top: 10px;
}

.quick-path {
  border: 1px solid rgba(148,163,184,0.32);
  background: rgba(255,255,255,0.7);
  border-radius: 13px;
  padding: 10px 12px;
  cursor: pointer;
  transition: 0.18s ease;
  color: #334155;
  font-size: 13px;
}

.quick-path:hover {
  border-color: rgba(37,99,235,0.48);
  background: #fff;
  transform: translateY(-1px);
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 28px;
  transform: translateX(-50%) translateY(20px);
  opacity: 0;
  background: rgba(15,23,42,0.92);
  color: #fff;
  padding: 11px 16px;
  border-radius: 999px;
  font-size: 14px;
  transition: 0.22s ease;
  z-index: 1000;
  pointer-events: none;
}

.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
</style>
</head>
<body>
<div class="container">

  <section class="hero">
    <div class="badge">⚡ Cloudflare Workers Subscription</div>
    <h1>${escapeHtml(FileName)}</h1>
    <p>简洁、美观，支持 VLESS / WS / TLS / path / ProxyIP / SOCKS5 / HTTP / 短链生成</p>
  </section>

  <div class="grid">

    <section class="card">
      <div class="card-header">
        <h2>🚀 生成订阅链接</h2>
        <p>填写必要参数后，一键生成 VLESS 订阅链接或短链接。</p>
      </div>

      <div class="card-body">
        <div class="form-group">
          <label class="title">
            伪装域名 host
            <span class="hint">必填</span>
          </label>
          <input id="host" placeholder="例如 example.com">
        </div>

        <div class="form-group">
          <label class="title">
            UUID
            <span class="hint">可留空使用环境变量 UUID</span>
          </label>
          <input id="uuid" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx">
        </div>

        <div class="form-group">
          <label class="title">
            优选地址 ips
            <span class="hint">多个用英文逗号分隔</span>
          </label>
          <textarea id="ips" placeholder="例如 1.1.1.1#CF, 2.2.2.2:443#节点2"></textarea>
        </div>

        <div class="form-group">
          <label class="title">
            path
            <span class="hint">可选</span>
          </label>
          <input id="path" placeholder="/p=ProxyIP.US.CMLiussss.net?ed=2560 或 /s=user:pass@ip:port?ed=2560">

          <div class="quick-paths">
            <div class="quick-path" onclick="setPath('/p=ProxyIP.US.CMLiussss.net?ed=2560')">填入 ProxyIP 示例：/p=ProxyIP.US.CMLiussss.net?ed=2560</div>
            <div class="quick-path" onclick="setPath('/s=admin:123456@123.123.28.123:13333?ed=2560')">填入 SOCKS5 示例：/s=admin:123456@123.123.28.123:13333?ed=2560</div>
            <div class="quick-path" onclick="setPath('/g=admin:123456@123.123.28.123:13333?ed=2560')">填入全局 SOCKS5 示例：/g=admin:123456@123.123.28.123:13333?ed=2560</div>
            <div class="quick-path" onclick="setPath('/h=192.168.1.1:1080?ed=2560')">填入 HTTP 示例：/h=192.168.1.1:1080?ed=2560</div>
            <div class="quick-path" onclick="setPath('/gh=192.168.1.1:1080?ed=2560')">填入全局 HTTP 示例：/gh=192.168.1.1:1080?ed=2560</div>
          </div>
        </div>

        <div class="options">
          <label class="option"><input type="checkbox" id="scv"> 跳过证书验证</label>
        </div>

        <div class="btn-row">
          <button class="btn-primary" onclick="generate()">生成链接</button>
          <button class="btn-success" onclick="generateShort()">生成短链</button>
        </div>
      </div>
    </section>

    <section class="stack">
      <div class="info-card">
        <h3>🔗 订阅链接</h3>
        <div id="result" class="result-box">生成后的订阅链接会显示在这里。</div>
      </div>

      <div class="info-card">
        <h3>✨ 短链</h3>
        <div id="shortResult" class="result-box">点击“生成短链”后会显示在这里。</div>
      </div>

      <div class="notice">
        注意：页面按钮生成的链接会自动编码 path 参数。手动拼接 URL 时，path 里的 <code>?</code>、<code>=</code>、<code>@</code>、<code>:</code> 建议进行 URL 编码。
      </div>
    </section>

  </div>

  <section class="stack" style="margin-top:22px;">
    <div class="info-card">
      <h3>📌 path 参数说明</h3>
      <ul>
        <li><code>/s=admin:123456@123.123.28.123:13333?ed=2560</code>：仅 SOCKS5</li>
        <li><code>/g=admin:123456@123.123.28.123:13333?ed=2560</code>：全局 SOCKS5</li>
        <li><code>/p=ProxyIP.US.CMLiussss.net?ed=2560</code>：仅 ProxyIP</li>
        <li><code>/h=192.168.1.1:1080?ed=2560</code>：回退 HTTP</li>
        <li><code>/gh=192.168.1.1:1080?ed=2560</code>：全局 HTTP</li>
      </ul>
    </div>

    <div class="info-card">
      <h3>🛠️ 接口示例</h3>
      <ul>
        <li><code>/sub?host=你的域名</code></li>
        <li><code>/sub?host=你的域名&amp;uuid=你的UUID</code></li>
        <li><code>/sub?host=你的域名&amp;uuid=你的UUID&amp;path=/p=ProxyIP.US.CMLiussss.net?ed=2560</code></li>
        <li><code>/sub?host=你的域名&amp;uuid=你的UUID&amp;path=/s=admin:123456@123.123.28.123:13333?ed=2560</code></li>
        <li><code>/sub?host=你的域名&amp;uuid=你的UUID&amp;path=/g=admin:123456@123.123.28.123:13333?ed=2560</code></li>
        <li><code>/sub?host=你的域名&amp;uuid=你的UUID&amp;path=/h=192.168.1.1:1080?ed=2560</code></li>
        <li><code>/sub?host=你的域名&amp;uuid=你的UUID&amp;path=/gh=192.168.1.1:1080?ed=2560</code></li>
        <li><code>/short?url=长订阅链接</code></li>
        <li><code>/uuid.json</code></li>
      </ul>
    </div>

    <div class="info-card">
      <h3>🔄 旧参数兼容</h3>
      <ul>
        <li><code>proxyip=ProxyIP.US.CMLiussss.net&amp;ed=2560</code> 等同于 <code>path=/p=ProxyIP.US.CMLiussss.net?ed=2560</code></li>
        <li><code>socks5=admin:123456@ip:port&amp;ed=2560</code> 等同于 <code>path=/s=admin:123456@ip:port?ed=2560</code></li>
        <li><code>socks5=admin:123456@ip:port&amp;global=1&amp;ed=2560</code> 等同于 <code>path=/g=admin:123456@ip:port?ed=2560</code></li>
        <li><code>http=192.168.1.1:1080&amp;ed=2560</code> 等同于 <code>path=/h=192.168.1.1:1080?ed=2560</code></li>
        <li><code>http=192.168.1.1:1080&amp;global=1&amp;ed=2560</code> 等同于 <code>path=/gh=192.168.1.1:1080?ed=2560</code></li>
      </ul>
    </div>
  </section>

  <div class="footer">
    当前 Worker 首页：<code>${origin}/</code>
  </div>

</div>

<div id="toast" class="toast"></div>

<script>
let lastSubLink = "";

function setPath(value) {
  document.getElementById("path").value = value;
  showToast("已填入 path 示例");
}

function buildSubLink() {
  const host = document.getElementById("host").value.trim();
  const uuid = document.getElementById("uuid").value.trim();
  const ips = document.getElementById("ips").value.trim();
  const path = document.getElementById("path").value.trim();

  if (!host) {
    showToast("请填写 host");
    document.getElementById("host").focus();
    return "";
  }

  const params = new URLSearchParams();
  params.set("host", host);

  if (uuid) params.set("uuid", uuid);
  if (ips) params.set("ips", ips);
  if (path) params.set("path", path);

  if (document.getElementById("scv").checked) {
    params.set("scv", "1");
  }

  return "${origin}/sub?" + params.toString();
}

function generate() {
  const link = buildSubLink();

  if (!link) return;

  lastSubLink = link;

  document.getElementById("result").innerHTML =
    '<a href="' + escapeAttr(link) + '" target="_blank">' + escapeHtmlJS(link) + '</a>' +
    '<br><button class="btn-copy" onclick="copyText(\\'' + escapeForSingleQuote(link) + '\\')">复制订阅链接</button>';

  document.getElementById("shortResult").innerHTML = "点击“生成短链”后会显示在这里。";
  showToast("订阅链接已生成");
}

async function generateShort() {
  let link = lastSubLink;

  if (!link) {
    link = buildSubLink();
  }

  if (!link) return;

  lastSubLink = link;

  document.getElementById("result").innerHTML =
    '<a href="' + escapeAttr(link) + '" target="_blank">' + escapeHtmlJS(link) + '</a>' +
    '<br><button class="btn-copy" onclick="copyText(\\'' + escapeForSingleQuote(link) + '\\')">复制订阅链接</button>';

  document.getElementById("shortResult").innerHTML = "短链生成中，请稍候...";

  try {
    const resp = await fetch("${origin}/short?url=" + encodeURIComponent(link));
    const data = await resp.json();

    if (data.shortUrl) {
      document.getElementById("shortResult").innerHTML =
        '<a href="' + escapeAttr(data.shortUrl) + '" target="_blank">' + escapeHtmlJS(data.shortUrl) + '</a>' +
        '<br><button class="btn-copy" onclick="copyText(\\'' + escapeForSingleQuote(data.shortUrl) + '\\')">复制短链</button>';

      showToast("短链已生成");
    } else {
      document.getElementById("shortResult").innerText =
        "短链生成失败：" + JSON.stringify(data);
      showToast("短链生成失败");
    }
  } catch (e) {
    document.getElementById("shortResult").innerText =
      "短链生成失败：" + e.message;
    showToast("短链生成失败");
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("已复制");
  } catch (e) {
    prompt("请手动复制", text);
  }
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(function() {
    toast.classList.remove("show");
  }, 1800);
}

function escapeForSingleQuote(str) {
  return String(str)
    .replace(/\\\\/g, "\\\\\\\\")
    .replace(/'/g, "\\\\'")
    .replace(/\\n/g, "\\\\n")
    .replace(/\\r/g, "\\\\r");
}

function escapeHtmlJS(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(str) {
  return escapeHtmlJS(str);
}
</script>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
