FROM node:20-alpine

WORKDIR /app

# Workspace manifests first (better layer caching)
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/

RUN npm install

# Source (overridden by bind mount in compose for hot reload)
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["npm", "run", "dev"]
