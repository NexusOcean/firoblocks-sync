FROM node:24-slim AS builder
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn --frozen-lockfile

COPY . .
RUN yarn build

FROM node:24-slim
WORKDIR /app

COPY package.json yarn.lock ./
RUN yarn --frozen-lockfile --production && yarn cache clean

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production

CMD ["yarn", "start"]