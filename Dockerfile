FROM node:18-alpine
LABEL maintainer="Nevermined <root@nevermined.io>"

RUN apk add --no-cache autoconf automake alpine-sdk

COPY package*.json yarn.lock ./

RUN yarn

COPY src ./src
COPY config ./config
COPY package.json ./
COPY tsconfig* ./
COPY .env.sample ./.env.sample
COPY accounts ./accounts
COPY argo-workflows-templates ./argo-workflows-templates

RUN yarn run setup:dev
RUN yarn run build

ENTRYPOINT ["yarn", "run", "start:prod"]

