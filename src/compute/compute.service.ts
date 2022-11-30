import { Injectable } from '@nestjs/common';

import { NeverminedService } from '../shared/nevermined/nvm.service';
import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import path from 'path';
import { ExecuteWorkflowDto } from "./dto/executeWorkflowDto";
import { DDO } from "@nevermined-io/nevermined-sdk-js";
import { ConfigService } from  '../shared/config/config.service';
import { Logger } from '../shared/logger/logger.service';
require('js-yaml');

export type WorkflowStatus = {
    status: string
    startedAt : string
    finishedAt: string         
    did: string,
    pods: string[]
    podName: string
}

@Injectable()
export class ComputeService {

  private networkName: string

  constructor(
      private configService: ConfigService,
      private nvmService: NeverminedService) {}

private async getNetworkName(): Promise<string>{

    if (!this.networkName)
        this.networkName= await this.nvmService.getNevermined().keeper.getNetworkName()
    
    return this.networkName
}

readExample(): any {
    const templatePath = path.join(__dirname, '/', './argo-workflows-templates/test-workflow.yaml');
    const templateContent = readFileSync(templatePath, 'utf8');

    return yaml.load(templateContent); 
 }

async createWorkflowStatus(responseBody:any, workflowID: string):Promise<WorkflowStatus> {

    
    let result; 
    const pods = [];
               
    // Transform from pairs of id:object to array of objects
    const nodesPairs = responseBody.status.nodes;
    const nodesArray = [];
    for (const i in nodesPairs){
        nodesArray.push(nodesPairs[i]);
    }

    nodesArray.forEach((element) => {
        const podName = element.displayName;
        if (podName === workflowID){
            result = {
                status: element.phase,
                startedAt: element.startedAt,
                finishedAt: element.finishedAt,         
                did: undefined,
                pods: []
            };
        }
        else {
            const statusMessage = {
                podName: podName,
                status: element.phase,
                startedAt: element.startedAt,
                finishedAt: element.finishedAt            
            };
            pods.push(statusMessage);
        }          
    });

    result.pods = pods
   
    if (result.status === 'Succeeded'){

        const query = {
            nested: {
                path: "service",
                query: {
                    match: { 'service.attributes.additionalInformation.customData.workflowID': workflowID }
                }
            }
        }

        const queryResult = await this.nvmService.getNevermined().assets.query({query: query})

        if (queryResult.totalResults.value > 0){
            const did = queryResult.results[0].id
            result.did = did    
        }
    }

    return result;

 }

 private readWorkflowTemplate(): any  {
    
    const templatePath = path.join(__dirname, '/', './argo-workflows-templates/nvm-compute-template.yaml');
    const templateContent = readFileSync(templatePath, 'utf8');

    return yaml.load(templateContent); 
  }

  async createArgoWorkflow(initData: ExecuteWorkflowDto, agreementId: string): Promise<any> {
 
    const workflow = this.readWorkflowTemplate();

    Logger.debug(`Resolving workflow DDO ${initData.workflowDid}`);
    const ddo: DDO = await this.nvmService.nevermined.assets.resolve(initData.workflowDid);
    Logger.debug(`workflow DDO ${initData.workflowDid} resolved`);
   
    workflow.metadata.namespace = this.configService.computeConfig().argo_namespace;
    workflow.spec.arguments.parameters = await this.createArguments(ddo, initData.consumer);
    workflow.spec.workflowMetadata.labels.serviceAgreement = agreementId;

    workflow.spec.entrypoint= "compute-workflow";

    Logger.debug(`workflow arguments parameters ${JSON.stringify( workflow.spec.arguments.parameters)}`);
/*
    TODO -  FEDERATED LEARNING USE CASES
    if  (( metadata.attributes.main.type) === 'fl-coordinator')
        workflow.spec.entrypoint= "coordinator-workflow"
*/

    return workflow;

  }

 private async createArguments(workflowDdo: DDO, consumerAddress: string):Promise<{name: string, value: string}[]>{
   
    const metadata = workflowDdo.findServiceByType('metadata');
    const workflow = metadata.attributes.main.workflow;

    // TODO: Currently this only supports one stage
    const transformationDid = workflow.stages[0].transformation.id;
    Logger.debug(`Resolving transformation Did ${transformationDid}`);

    const transformationDdo: DDO = await this.nvmService.nevermined.assets.resolve(transformationDid);
    const transformationMetadata = transformationDdo.findServiceByType('metadata');

    // get args and container
    const args = transformationMetadata.attributes.main.algorithm.entrypoint;
    const image = transformationMetadata.attributes.main.algorithm.requirements.container.image;
    const tag = transformationMetadata.attributes.main.algorithm.requirements.container.tag;

    Logger.debug(`transformation args: ${args}`);
    Logger.debug(`transformation container: ${image}`);
    Logger.debug(`transformation tag: ${tag}`);

    const gethLocal = await this.getNetworkName() === 'geth-localnet'

    if (gethLocal)
        Logger.debug(`Compute Stack running in Nevermined Tools. Using ${this.configService.computeConfig().gethlocal_host_name} as host for NVM services`)

    return [
            {
                name: "volume",
                value: "/data"
            },
            {
                name: "provider_key_file",
                value: this.configService.cryptoConfig().provider_key
            },
            {
                name: "provider_password",
                value: this.configService.cryptoConfig().provider_password
            },
            {
                name: "marketplace_api_url",
                value: gethLocal?`http://${this.configService.computeConfig().gethlocal_host_name}:3100`:this.configService.nvm().marketplaceUri
            },
            {
                name: "web3_provider_url",
                value: gethLocal?`http://${this.configService.computeConfig().gethlocal_host_name}:8545`:this.configService.nvm().web3ProviderUri
            },
            {
                name: "node_address",
                value: this.configService.nvm().neverminedNodeAddress
            },
            {
                name: "node_url",
                value: gethLocal?`http://${this.configService.computeConfig().gethlocal_host_name}:8030`:this.configService.nvm().neverminedNodeUri
            },
            {
                name: "workflow_did",
                value: workflowDdo.id
            },
            {
                name: "consumer_address",
                value: consumerAddress
            },
            {
                name: "minio_host",
                value: gethLocal?`${this.configService.computeConfig().gethlocal_host_name}`:this.configService.computeConfig().minio_host
            },
            {
                name: "minio_port",
                value: this.configService.computeConfig().minio_port
            },
            {
                name: "minio_access_key",
                value: this.configService.computeConfig().minio_access_key
            },
            {
                name: "minio_secret_key",
                value: this.configService.computeConfig().minio_secret_key
            },
            {
                name: "minio_bucket_prefix",
                value: "pod-publishing-"
            },
            {
                name: "transformation_container_image",
                value: `${image}:${tag}`
            },
            {
                name: "transformation_arguments",
                value: args
            },
            {
                name: "artifacts_folder",
                value: "/artifacts"
            },
            {
                name: "input_dir",
                value: "inputs"
            },
            {
                name: "output_dir",
                value: "outputs"
            },
            {
                name: "transformations_dir",
                value: "transformations"
            },
            {
                name: "verbose",
                value: "true"
            }
    ];
  }
}