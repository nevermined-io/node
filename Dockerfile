FROM node:16-alpine
LABEL maintainer="Nevermined <root@nevermined.io>"

RUN apk add --no-cache autoconf automake alpine-sdk

COPY package*.json ./

RUN npm install

COPY src ./src
COPY config ./config
COPY package*.json ./
COPY tsconfig* ./
COPY .env.sample ./.env
COPY accounts ./accounts
COPY artifacts ./artifacts

RUN npm run build
RUN npm run setup:dev

ENTRYPOINT ["npm", "run", "start:prod"]

