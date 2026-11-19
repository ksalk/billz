# syntax=docker/dockerfile:1

FROM node:26.12.1-bookworm-slim@sha256:88e480776c6149ff1d098cd304f44bf18057fb5d284a3329b78162d29821e28c AS ui

WORKDIR /build/frontend
RUN npm install --global pnpm@12.15.0

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm run build

FROM mcr.microsoft.com/dotnet/sdk:11.0.100@sha256:65f3c7c6a25a239ab3e6719f2896147e7b68242ff2d8818dd70498bde6ef8bea AS build

ARG TARGETARCH

WORKDIR /src
COPY global.json Directory.Build.props ./
COPY src/Billz.Api/Billz.Api.csproj src/Billz.Api/
COPY src/Billz.Api/packages.lock.json src/Billz.Api/
RUN dotnet restore src/Billz.Api/Billz.Api.csproj --locked-mode

COPY src/Billz.Api/ src/Billz.Api/
COPY --from=ui /build/src/Billz.Api/wwwroot src/Billz.Api/wwwroot/
RUN dotnet publish src/Billz.Api/Billz.Api.csproj -c Release -o /app --no-restore /p:UseAppHost=false \
    && case "$TARGETARCH" in \
         amd64) native_rid="linux-x64" ;; \
         arm64) native_rid="linux-arm64" ;; \
         *) echo "Unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
       esac \
    && rm -rf /app/BuildHost-net472 /app/BuildHost-netcore \
    && find /app/runtimes -mindepth 1 -maxdepth 1 -type d ! -name "$native_rid" -exec rm -rf {} + \
    && rm -f /app/appsettings.Development.json /app/web.config

FROM mcr.microsoft.com/dotnet/aspnet:10.0.15@sha256:12b1135f5f8b3c0a214f2a680ff2033dff4f684f445d6c697d9524ceeb303586 AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

LABEL org.opencontainers.image.title="Billz" \
      org.opencontainers.image.description="Self-hosted bill and recurring-payment tracker" \
      org.opencontainers.image.licenses="MIT" \
      org.opencontainers.image.source="https://github.com/ksalk/billz"

WORKDIR /app
COPY --from=build --chown=app:app /app ./

RUN mkdir -p /data && chown app:app /data

ENV ASPNETCORE_HTTP_PORTS=8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_EnableDiagnostics=0

USER app
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=15s --retries=3 \
    CMD curl -fsS http://127.0.0.1:8080/api/health || exit 1

ENTRYPOINT ["dotnet", "Billz.Api.dll"]
