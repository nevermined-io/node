import { Injectable } from '@nestjs/common';

//import { NeverminedService } from '../shared/nevermined/nvm.service';
//import { didZeroX, zeroX } from '@nevermined-io/nevermined-sdk-js/dist/node/utils';
import yaml from 'js-yaml';
import { readFileSync } from 'fs';
import path from 'path';
import { InitDto } from "./dto/init";
import { DDO } from "@nevermined-io/nevermined-sdk-js";
import { ConfigService } from  '../shared/config/config.service'

@Injectable()
export class ComputeService {

  constructor(private configService: ConfigService) {}
 // constructor(private nvmService: NeverminedService) {}

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
    if  (( metadata.attributes.main.type) === 'fl-coordinator')
        workflow.spec.entrypoint= "coordinator-workflow"
    else 
        workflow.spec.entrypoint= "compute-workflow"
        */

    return workflow;

  }

  createArguments(ddo: DDO){

    var args: string = ''
    //var image: string = ''
    //var tag: string = ''

    //const metadata = ddo.findServiceByType('metadata')
   // const workflow = metadata.attributes.main.workflow
    
   /*
    const  options = {
        "resources": {
            "metadata.url": "http://172.17.0.1:5000",
        },
        "keeper-contracts": {
            "keeper.url": "http://172.17.0.1:8545"
        }
    }
*/
    /*
 # TODO: Currently this only supports one stage
        transformation_did = workflow["stages"][0]["transformation"]["id"]
        transformation_ddo = nevermined.assets.resolve(transformation_did)
        transformation_metadata = transformation_ddo.get_service("metadata")

        # get args and container
        args = transformation_metadata.main["algorithm"]["entrypoint"]
        image = transformation_metadata.main["algorithm"]["requirements"]["container"]["image"]
        tag = transformation_metadata.main["algorithm"]["requirements"]["container"]["tag"]
    */

    // TODO. remove harcoded urls    

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
                value: "http://172.17.0.1:5000"
            },
            {
                name: "gateway_url",
                value: "http://172.17.0.1:8030"
            },
            {
                name: "node",
                value: "http://172.17.0.1:8545"
            },
            {
                name: "secret_store_url",
                value: "http://172.17.0.1:12001"
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
                // TODO
                value: "{image}:{tag}"
            },
            {
                name: "transformation_arguments",
                value: args
            }
    ]
  }
}