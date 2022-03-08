# Marketplace API

Rest api for market place

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
