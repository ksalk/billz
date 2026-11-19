# syntax=docker/dockerfile:1

FROM node:26.12.1-bookworm-slim@sha256:88e480776c6149ff1d098cd304f44bf18057fb5d284a3329b78162d29821e28c AS ui

WORKDIR /build/frontend
RUN npm install --global pnpm@12.15.0

COPY frontend/package.json frontend/pnpm-lock.yaml frontend/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0.101@sha256:5504edd1267dd4deab3443f960cfab219249c8bd935fbcc358f1c24aeae23fe0 AS build

WORKDIR /src
COPY global.json Directory.Build.props ./
COPY src/Billz.Api/Billz.Api.csproj src/Billz.Api/
COPY src/Billz.Api/packages.lock.json src/Billz.Api/
RUN dotnet restore src/Billz.Api/Billz.Api.csproj --locked-mode

COPY src/Billz.Api/ src/Billz.Api/
COPY --from=ui /build/src/Billz.Api/wwwroot src/Billz.Api/wwwroot/
RUN dotnet publish src/Billz.Api/Billz.Api.csproj -c Release -o /app --no-restore /p:UseAppHost=false

FROM mcr.microsoft.com/dotnet/aspnet:10.0.1@sha256:eb4c0af832f281ac1a83fa78c09da328cb9df2d7d608bdebc21ce843d66d896f AS runtime

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

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
