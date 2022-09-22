FROM node:16-alpine
LABEL maintainer="Nevermined <root@nevermined.io>"

RUN apk add --no-cache autoconf automake alpine-sdk

COPY package*.json ./

RUN npm i -g yarn
RUN yarn

COPY src ./src
COPY config ./config
COPY package*.json ./
COPY tsconfig* ./
COPY .env.sample ./.env
COPY accounts ./accounts

RUN yarn run setup:dev
RUN yarn run build

ENTRYPOINT ["yarn", "run", "start:prod"]

