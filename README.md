[![banner](https://raw.githubusercontent.com/nevermined-io/assets/main/images/logo/banner_logo.png)](https://nevermined.io)

# Nevermined Gateway

> Navermined Gateway for handling automatic fulfilling of agreements etc.

[![Tests](https://github.com/nevermined-io/marketplace-api/actions/workflows/test.yml/badge.svg)](https://github.com/nevermined-io/marketplace-api/actions/workflows/test.yml)
[![Docker Build Status](https://img.shields.io/docker/cloud/build/neverminedio/marketplace-api.svg)](https://hub.docker.com/repository/docker/neverminedio/marketplace-api)
[![GitHub contributors](https://img.shields.io/github/contributors/nevermined-io/marketplace-api.svg)](https://github.com/nevermined-io/marketplace-api/graphs/contributors)

## First-time setup

### Pre-requisites

- Make sure you've installed [docker](https://www.docker.com/products/docker-desktop)
- Make sure you've installed NodeJS version. You can see the version in the `nvmrc` file
- You can also install [nvm](https://github.com/nvm-sh/nvm) in order to switch between different node versions
- Set npm to install internal packages. See guide [here](https://coachhub.atlassian.net/wiki/spaces/ENG/pages/21692438/github)

### Install dependencies

Install all necessary dependencies via:

```bash
npm install
```

### Copy profile configuration

Copy the local profile configuration via:

```bash
npm run setup:dev
```

This will leave you with a `local.js` file within the `config` folder that will be used as the profile configuration.

### Setting up the database

There are few options while it comes to database setup.

1. **<u>Run Database Locally</u>**:

   - You can setup a elastic search database locally.
   - Then update the credentials in your local.js file from previous step as:

   ```javascript
   elasticsearch: {
      node: ''
      auth: {
         username: 'elastic',
         password: 'password',
      }
   },
   ```

   - Your onboarding buddy can share a copy of database dump with you for the initial data

2. <u>**Run from Docker**</u>:

   - Create .env file:
   ```
   # Password for the 'elastic' user (at least 6 characters)
   ELASTIC_PASSWORD=[YOUR PASSWORD]

   ELASTIC_USERNAME=[YOUR USERNAME]
   ```
   - Make sure you installed docker
   - From project root in terminal run

   ```javascript
      docker-compose up
   ```

## Install and run:

```javascript
npm run dev
```

### Build production environment

```bash
npm build
```

### Directory structure

```
- src
  - greeting          # Domain model, more specifically, an aggregate, where cat is the root aggregate (example endpoint)
  - common        # Cross-cutting functionality, like guards, middleware or interceptors
  - shared        # Modules and services that are used shared between services (Elasticsearch service is include here for example)
- config          # Configuration per profile
```



## License

```
Copyright 2022 Nevermined AG

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```
