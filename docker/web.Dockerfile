FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/

RUN npm install

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

WORKDIR /app/apps/web
EXPOSE 5173
CMD ["npm", "run", "dev"]
