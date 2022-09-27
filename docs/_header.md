---
sidebar_position: 1
description: Nevermined Gateway Overview
---

# Gateway Overview

In the Nevermined ecosystem, the [Gateway](https://github.com/nevermined-io/gateway-ts/) is 
the technical component executed by the Publishers and/or Content Providers allowing them 
to offer extended data services (e.g. storage and compute).

Nevermined Gateway, as part of the Publisher ecosystem, includes the credentials to interact
with the infrastructure (initially cloud, but could be on-premise) and validate/authorize
that consumers are able to execute certain actions via the Nevermined Decentralized Access Control.

In the Nevermined architecture a content publisher or provider defines the rules about how their
content can be used (transfered, accessed, sold) by the rest of the world. And consumers knowing
that can make use (or not) of these contents. All this transactions are recorded via the 
Nevermined Smart Contracts, and the gateway use them to authorize users to do certain actions.

A typical scenario of the gateway is for example give access to off-chain data (data sharing) 
stored in a cloud provider, when a consumer paid for that access. The gateway is specially designed
to facilitate this level of authorization bringing the gap between the permissions reflected 
in the Smart Contracts and off-chain data and computation.

The Gateway allows also the encryption and decryption of content using RSA and ECDSA. 

To interact with it, the gateway exposes a HTTP REST Api using OpenAPI. The file including the 
API specification can be found in the [openapi.json file](https://github.com/nevermined-io/gateway-ts/blob/main/docs/openapi.json).


