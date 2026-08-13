# syntax=docker/dockerfile:1

# Website UI: Docusaurus built to static files, served by nginx.
# Build context is the repo root (needs ./lexicons for client codegen).
#
# Node 22 per .node-version. Note package.json still says engines 18.x, but
# @atproto/lex's codegen CLI requires >=22, so 18 can no longer build this site.

FROM node:22-bookworm-slim AS build

WORKDIR /app

# Deps first so the install layer survives content-only changes.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# All three values are read by docusaurus.config.js and BAKED INTO the static
# output, so this image is environment-specific: one build per site host + API
# origin pair.
#
# Both origins have a fallback in the config, and we refuse to inherit either
# one here, because both fallbacks produce an image that looks fine and is
# wrong:
#
#   BPS_PUBLIC_API_ORIGIN falls back to localhost, sending every logged-in
#   account request to 127.0.0.1.
#
#   BPS_SITE_URL falls back to production (bsky.network). An image built that
#   way and served anywhere else publishes an OAuth client_id document naming a
#   host it isn't served from, which the authorization server rejects — so the
#   site builds, deploys, and serves every page correctly, and login dies at the
#   consent screen. Nothing before that point notices.
#
# ENDPOINTS_URL is optional, and today it is inert: nothing reads
# customFields.endpointsUrl, and the homepage hardcodes endpoints.bsky.app. The
# build arg exists so the seam still works if that card is ever wired back up.
ARG BPS_PUBLIC_API_ORIGIN
ARG BPS_SITE_URL
ARG ENDPOINTS_URL
RUN if [ -z "$BPS_PUBLIC_API_ORIGIN" ] || [ -z "$BPS_SITE_URL" ]; then \
      echo "ERROR: --build-arg BPS_PUBLIC_API_ORIGIN=https://... and" >&2; \
      echo "       --build-arg BPS_SITE_URL=https://... are both required." >&2; \
      echo "       They are baked into the static build; there is no runtime override." >&2; \
      exit 1; \
    fi

RUN npm run lex:build && npm run build


FROM nginx:1.27-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
