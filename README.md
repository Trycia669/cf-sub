# CF VLESS SUB

一个基于 **Cloudflare Workers** 的 VLESS 订阅链接生成器。

本项目用于在 Cloudflare Workers 上部署一个轻量级订阅生成页面，通过网页表单或接口参数快速生成：

- `VLESS + WS + TLS` 节点
- Base64 原始订阅
- Clash / Mihomo / Sing-box 等客户端可用订阅
- 短链接
- UUID JSON 接口

> 当前版本已经移除 `Trojan` 和 `XHTTP` 相关选项，仅保留 `VLESS + WS + TLS`。

---

## 功能特性

- 基于 Cloudflare Workers，无需服务器
- 首页可视化生成订阅链接
- 支持自定义 UUID
- 支持自定义伪装域名 Host
- 支持优选 IP / 优选域名
- 支持自定义 WebSocket Path
- 支持 ProxyIP path
- 支持 SOCKS5 path
- 支持全局 SOCKS5 path
- 支持 HTTP path
- 支持全局 HTTP path
- 支持跳过证书验证参数
- 支持短链生成
- 支持 `/uuid.json` 接口
- 支持订阅转换后端
- 支持 Clash / Mihomo / Sing-box 自动识别转换
- 已移除 Trojan 选项
- 已移除 XHTTP 选项

---

## 项目结构

```text
cf-vless-sub/
├── src/
│   └── worker.js
├── wrangler.toml
├── package.json
├── README.md
├── .gitignore
├── LICENSE
└── .github/
    └── workflows/
        └── deploy.yml
