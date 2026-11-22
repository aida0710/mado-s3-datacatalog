# nginx/Dockerfile

# ステージ 1: front を build
# 画面のビルドの結果は静的なファイルで、CPUの種類に依らない。ビルド機のCPUでそのまま走らせる
# （arm64向けをエミュレーションでビルドすると、viteのビルドが終わらないことがある）。
FROM --platform=$BUILDPLATFORM node:22-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS frontbuild
WORKDIR /front
# About 表示用のコミット情報。.git はビルドコンテキストに無いので host から渡す
# (compose.prod.yaml の build.args → deploy.sh が git から export)。未指定なら 'dev'。
ARG MDC_GIT_COMMIT=""
ARG MDC_GIT_DATE=""
ARG MDC_VERSION=dev
ENV MDC_GIT_COMMIT=$MDC_GIT_COMMIT
ENV MDC_GIT_DATE=$MDC_GIT_DATE
COPY front/package.json front/package-lock.json ./
RUN npm ci
COPY front .
COPY api/shared /api/shared
RUN npm run build

# ステージ 2: nginx に静的成果物と設定を焼く
# nginxinc/nginx-unprivileged は default で nginx user (uid 101) として
# 8080 で listen する。port 80 は privileged なので非 root では bind できない。
FROM nginxinc/nginx-unprivileged:alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e AS release
ARG MDC_VERSION=dev
ARG VCS_REF=""
ARG BUILD_DATE=""
LABEL org.opencontainers.image.title="mado S3 Data Catalog Web" \
      org.opencontainers.image.description="mado S3 Data Catalog web UI and ingress" \
      org.opencontainers.image.source="https://github.com/aida0710/mado-s3-datacatalog" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.version="$MDC_VERSION" \
      org.opencontainers.image.revision="$VCS_REF" \
      org.opencontainers.image.created="$BUILD_DATE"
COPY --from=frontbuild /front/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
