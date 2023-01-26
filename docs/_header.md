---
sidebar_position: 1
description: Nevermined Node Overview
---

# Node Overview

In the Nevermined ecosystem, the [Node](https://github.com/nevermined-io/node-ts/) is
the technical component executed by the Publishers and/or Content Providers allowing them
to offer extended data services (e.g. storage and compute).

Nevermined Node, as part of the Publisher ecosystem, includes the credentials to interact
with the infrastructure (initially cloud, but could be on-premise) and validate/authorize
that consumers are able to execute certain actions via the Nevermined Decentralized Access Control.

In the Nevermined architecture a content publisher or provider defines the rules about how their
content can be used (transfered, accessed, sold) by the rest of the world. And consumers knowing
that can make use (or not) of these contents. All this transactions are recorded via the
Nevermined Smart Contracts, and the node use them to authorize users to do certain actions.

A typical scenario of the node is for example give access to off-chain data (data sharing)
stored in a cloud provider, when a consumer paid for that access. The node is specially designed
to facilitate this level of authorization bringing the gap between the permissions reflected
in the Smart Contracts and off-chain data and computation.

The Node allows also the encryption and decryption of content using RSA and ECDSA.

# Compute Endpoints

The [Nevermined Node](https://github.com/nevermined-io/node) is also in charge of
 orchestrating the execution of compute jobs in the premises of
 the Data/Compute Providers.

 In Nevermined the Data/Compute Providers can publish services saying they offer
  compute capabilities to the network on top of their data under some conditions
   for a given price. The Nevermined Node is in charge of, after run all the
   verifications needed, to manage all the infrastructure to move
   the algorithm where the data is and track the execution of these ephemeral
   environments.

The Nevermined Node exposes a set of endpoints in its REST API, that can plugs
different compute backends. At this point in time, integrates
2 different backends:

* **Kubernetes backend** - It allows the orchestration of Kubernetes clusters
for setting up compute workflows in cloud or on-premise environments.  
* **Federated Learning backend** - It manages the execution of FL jobs in
different federated environments. It starts the coordinator and an aggregator
tasks doing the management of the participants as part of a federated job and
the secure aggregation of the trained models.

# REST API

To interact with it, the node exposes a HTTP REST Api using OpenAPI. The file including the
API specification can be found in the [openapi.json file](https://github.com/nevermined-io/node-ts/blob/main/docs/openapi.json).
