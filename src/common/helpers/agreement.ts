import { UnauthorizedException } from '@nestjs/common';
import { Account, ConditionState, DDO, Nevermined } from '@nevermined-io/nevermined-sdk-js';
import { config } from '../../config';
import { ConditionInstance } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/conditions';
import { AgreementInstance } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/templates';
import { TxParameters } from '@nevermined-io/nevermined-sdk-js/dist/node/keeper/contracts/ContractBase';

export interface Template<T> {
  instanceFromDDO: (a: string, b: DDO, c: string, d: T) => Promise<AgreementInstance<T>>
}

export interface NormalCondition {
  fulfillInstance: (a: ConditionInstance<{}>, b: {}, from: Account, params?: TxParameters, method?: string) => Promise<any>
  sendFrom: (name: string, args: any[], from: Account) => Promise<any>
}

export interface ConditionInfo {
  fulfill: boolean,
  condition?: NormalCondition,
  name: string,
  delegate?: boolean,
}

export interface Params<T> {
  agreement_id: string, 
  did: string, 
  template: Template<T>,
  params: T,
  conditions: ConditionInfo[]
}

export async function validateAgreement<T>({
  agreement_id, 
  did, 
  template,
  params,
  conditions,
}: Params<T>) {
  const nevermined = await Nevermined.getInstance(config)
  const ddo = await nevermined.assets.resolve(did)
  /*
  const templateId: string = await nevermined.keeper.agreementStoreManager.call('getAgreementTemplate', [
    agreement_id
  ])
  console.log('template', templateId, 'for', agreement_id)
  */
  const agreement = await nevermined.keeper.agreementStoreManager.getAgreement(agreement_id)
  const agreementData = await template.instanceFromDDO(
    agreement.agreementIdSeed,
    ddo,
    agreement.creator,
    params
  )
  if (agreementData.agreementId !== agreement_id) {
    throw new UnauthorizedException(`Agreement doesn't match ${agreement_id} should be ${agreementData.agreementId}`)
  }
  const [from] = await nevermined.accounts.list()
  // Check that lock condition is fulfilled
  await Promise.all(conditions.map(async (a,idx) => {
    if (!a.fulfill) {
      const lock_state = await nevermined.keeper.conditionStoreManager.getCondition(agreementData.instances[idx].id)
      if (lock_state.state !== ConditionState.Fulfilled) {
        throw new UnauthorizedException(`In agreement ${agreement_id}, ${a.name} condition ${agreementData.instances[idx].id} is not fulfilled`)
      }
    }
  }))
  for (let {idx, a} of conditions.map((a,idx) => ({idx, a}))) {
    if (a.fulfill) {
        // console.log('fulfilling', a, idx)
      const condInstance = agreementData.instances[idx] as ConditionInstance<{}>
      const method = a.delegate ? 'fulfillForDelegate' : 'fulfill'
      await a.condition.fulfillInstance(condInstance, {}, from, undefined, method)
      const lock_state = await nevermined.keeper.conditionStoreManager.getCondition(agreementData.instances[idx].id)
      if (lock_state.state !== ConditionState.Fulfilled) {
        throw new UnauthorizedException(`In agreement ${agreement_id}, ${a.name} condition ${agreementData.instances[idx].id} is not fulfilled`)
      }
    }
  }
}