import { Injectable } from '@nestjs/common';

import { NeverminedService } from '../shared/nevermined/nvm.service';
//import { didZeroX, zeroX } from '@nevermined-io/nevermined-sdk-js/dist/node/utils';
import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import path from 'path';
import { InitDto } from "./dto/init";
import { DDO } from "@nevermined-io/nevermined-sdk-js";
import { ConfigService } from  '../shared/config/config.service'
import { clearScreenDown } from 'readline';

@Injectable()
export class ComputeService {

  constructor(
      private configService: ConfigService,
      private nvmService: NeverminedService) {}

 createWorkflowStatus(responseBody:any, workflowID: string):any {

    let result 
    let pods = []
               
    // Transform from tuple objects to array
    const nodesTuples = responseBody.status.nodes
    var nodesArray = []
    for (var i in nodesTuples){
        nodesArray.push(nodesTuples[i])
    }

    nodesArray.forEach((element) => {
        const podName = element.displayName
        if (podName === workflowID){
            result = {
                "status": element.phase,
                "startedAt": element.startedAt,
                "finishedAt": element.finishedAt,         
                "did": undefined,
                "pods": []
            }
        }
        else {
            const statusMessage = {
                "podName": podName,
                "status": element.phase,
                "startedAt": element.startedAt,
                "finishedAt": element.finishedAt || undefined            
            }
            pods.push(statusMessage)
        }          
    })

    result = {...result, pods: pods}
    // TODO look for did
    if (result.status === 'Succeeded'){
        result = {...result, did:"did:nv:xxxxx"}
        /*
            ddo = nevermined.assets.search(f'"{execution_id}"')[0]
            result["did"] = ddo.did
        */
    }

    return result

 }

 readExample(): any {
    require('js-yaml')

    const templatePath = path.join(__dirname, '/', 'test-workflow.yaml');
    const templateContent = readFileSync(templatePath, 'utf8');

    return yaml.load(templateContent); 
 }

  readWorkflowTemplate(): any  {
    require('js-yaml')

    const templatePath = path.join(__dirname, '/', 'argo-workflow-template.yaml');
    const templateContent = readFileSync(templatePath, 'utf8');

    return yaml.load(templateContent); 
  }

  createArgoWorkflow(initData: InitDto): any {
 
    const workflow = this.readWorkflowTemplate();
    const ddo: DDO = DDO.deserialize(initData.computeDdoString);

    workflow.metadata.namespace = this.configService.computeConfig().argo_namespace;
    workflow.spec.arguments.parameters = this.createArguments(ddo);
    workflow.spec.workflowMetadata.labels.serviceAgreement = initData.agreementId

    workflow.spec.entrypoint= "compute-workflow"
/*
    TODO -  FEDERATED LEARNING USE CASES
    if  (( metadata.attributes.main.type) === 'fl-coordinator')
        workflow.spec.entrypoint= "coordinator-workflow"
    else 
        workflow.spec.entrypoint= "compute-workflow"
*/

    return workflow;

  }

  async createArguments(ddo: DDO):Promise<any>{
   
    const metadata = ddo.findServiceByType('metadata')
    const workflow = metadata.attributes.main.workflow

    // TODO: Currently this only supports one stage
    const transformationDid = workflow.stages[0].transformation.id
    const transformationDdo: DDO = await this.nvmService.nevermined.assets.resolve(transformationDid)
    let transformationMetadata = transformationDdo.findServiceByType('metadata')

    // get args and container
    const args = transformationMetadata.attributes.main.algorithm.entrypoint
    const image = transformationMetadata.attributes.main.algorithm.requirements.container.image
    const tag = transformationMetadata.attributes.main.algorithm.requirements.container.tag
    
    // TODO. credentials, did   
    return [
            {
                name: "credentials",
                //remove white spaces
                //"value": json.dumps(KEYFILE, separators=(",", ":"))
                value: "KK"
            },
            {
                name: "password",
                value: process.env.PROVIDER_PASSWORD || "wewe"
            },
            {
                name: "metadata_url",
                value: this.configService.nvm().marketplaceUri
            },
            {
                name: "gateway_url",
                value: this.configService.nvm().gatewayUri
            },
            {
                name: "node",
                value: this.configService.nvm().nodeUri
            },
            {
                name: "workflow",
                // TODO
                value: "did:nv:{ddo.asset_id[2:]}"
            },
            {
                name: "verbose",
                value: "false"
            },
            {
                name: "transformation_container_image",
                value: `${image}:${tag}`
            },
            {
                name: "transformation_arguments",
                value: args
            }
    ]
  }
}