FROM renovate/buildpack:6@sha256:21dc773894c12276bb3ed23dac42728eddcab5dcb406db7eb03295f226ce7de9 AS base

LABEL name="commodore-renovate"
LABEL org.opencontainers.image.source="https://github.com/projectsyn/commodore-renovate" \
  org.opencontainers.image.licenses="AGPL-3.0-only"

# renovate: datasource=node
RUN install-tool node v14.19.0

WORKDIR /usr/src/app



FROM base as tsbuild

# renovate: datasource=npm versioning=npm
RUN install-tool yarn 1.22.17

COPY package.json yarn.lock ./
RUN yarn install --production

COPY src/ src/
COPY tsconfig.json tsconfig-build.json ./
RUN yarn build



FROM base as final

ENV NODE_ENV production

COPY --from=tsbuild /usr/src/app/bin bin
COPY --from=tsbuild /usr/src/app/node_modules node_modules

# renovate: datasource=github-releases lookupName=containerbase/python-prebuild
RUN install-tool python 3.9.0
RUN install-apt build-essential
COPY requirements.txt .
RUN pip install  -r requirements.txt

RUN set -ex; \
  chmod +x /usr/src/app/bin/index.js; \
  ln -sf /usr/src/app/bin/index.js /usr/local/bin/renovate;
CMD ["renovate"]

USER 1000
