# 红楼梦站点部署说明

本仓库是 `sites-stack` 的业务子项目。生产环境的 Compose、公网 Caddy、Docker network 和域名路由都由 `sites-stack` 统一维护；本仓库只负责定义红楼梦站点镜像如何构建，以及提供单项目本地预览方式。

## 文件职责

- `Dockerfile`：生产站点镜像。构建前端产物后，用 nginx 暴露容器内 `80` 端口。
- `deploy/nginx.conf`：站点容器内部的静态文件服务配置。
- `deploy/compose.local.yml`：不经过 `sites-stack` 时，本仓库单独本地预览用。

本仓库不再维护生产 `compose.yml`、入口 Caddyfile 或上传包脚本。生产拓扑应以 `sites-stack/compose.yml` 为唯一来源。

## 和 sites-stack 配合

`sites-stack` 应把本仓库作为 submodule 放在：

```text
sites-stack/sites/hongloumeng
```

生产 Compose 中的站点服务可以直接从 submodule 构建：

```yaml
services:
  hongloumeng:
    build:
      context: ./sites/hongloumeng
    restart: unless-stopped
    expose:
      - "80"
    networks:
      - public
```

入口 Caddy 仍在 `sites-stack/edge-caddy/Caddyfile` 中维护，并通过 Docker DNS 访问：

```caddyfile
yangsan.online {
	encode zstd gzip
	reverse_proxy hongloumeng:80
}
```

更新本项目后，需要先提交并推送本仓库，再在 `sites-stack` 中更新 submodule 指针：

```bash
git submodule update --remote --merge sites/hongloumeng
git add sites/hongloumeng
git commit -m "chore: update hongloumeng submodule"
```

## 本仓库单独预览

```bash
docker compose -f deploy/compose.local.yml up -d --build
```

访问：

```text
http://127.0.0.1:4180/
```

如需换端口：

```bash
HONGLOUMENG_LOCAL_PORT=5180 docker compose -f deploy/compose.local.yml up -d --build
```
