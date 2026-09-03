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

# These values are read by docusaurus.config.js and BAKED INTO the static
# output, so this image is environment-specific.
#
# BPS_PUBLIC_API_ORIGIN has a localhost dev fallback in the config. We refuse
# to inherit it here — an image built with that fallback looks fine and sends
# every logged-in account request to 127.0.0.1. Fail the build instead.
#
# ENDPOINTS_URL is optional, and today it is inert: nothing reads
# customFields.endpointsUrl, and the homepage hardcodes endpoints.bsky.app. The
# build arg exists so the seam still works if that card is ever wired back up.
ARG BPS_PUBLIC_API_ORIGIN
ARG BPS_SPACES_PDS_URL
ARG ENDPOINTS_URL
RUN if [ -z "$BPS_PUBLIC_API_ORIGIN" ]; then \
      echo "ERROR: --build-arg BPS_PUBLIC_API_ORIGIN=https://... is required." >&2; \
      echo "       It is baked into the static build; there is no runtime override." >&2; \
      exit 1; \
    elif [ -z "$BPS_SPACES_PDS_URL" ]; then \
      echo "ERROR: --build-arg BPS_SPACES_PDS_URL=https://... is required." >&2; \
      echo "       It is baked into the Spaces alpha account links." >&2; \
      exit 1; \
    fi

RUN npm run lex:build && npm run build

# Standard.site verification tags. The final build happens here, not on a
# developer's machine, so `sequoia inject` has to run inside the image — a local
# inject writes into a ./build that never reaches production.
#
# The wrapper scopes inject to the default locale and fails the build when it
# would otherwise no-op; see scripts/inject-standard-site.mjs. Offline: it reads
# .sequoia-state.json (committed) and rewrites HTML. Publishing the records is
# still a deliberate local step.
RUN npm run inject


FROM nginx:1.27-alpine

COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build /usr/share/nginx/html

EXPOSE 80
