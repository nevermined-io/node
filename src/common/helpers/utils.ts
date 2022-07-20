import { ForbiddenException } from '@nestjs/common';
import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import path from 'path';
import { AuthRoles } from '../type';
import crypto from 'crypto';
import ecies from 'ecies-lite';

export const checkOwnership = (userId: string, entityUserId: string, roles: AuthRoles[]) => {
  if (!roles.some((r) => r === AuthRoles.Admin) && userId !== entityUserId) {
    throw new ForbiddenException('This source only can be created or updated by the owner or admin');
  }
};

export const encrypt = async (cipherText) => {
  const provider_key_file = readFileSync(path.join(__dirname, '../../..', process.env['PROVIDER_KEYFILE'] || '')).toString()
  const provider_password = process.env['PROVIDER_PASSWORD'] || ''
  const wallet = await ethers.Wallet.fromEncryptedJson(provider_key_file, provider_password)
  let ecdh = crypto.createECDH('secp256k1');
  ecdh.setPrivateKey(Buffer.from(wallet.privateKey))
  return {
    publicKey: wallet.publicKey,
    result: ecies.encrypt(ecdh.getPublicKey(), Buffer.from(cipherText)).toString()
  }
};

export const decrypt = async (cipherText) => {
  const provider_key_file = readFileSync(path.join(__dirname, '../../..', process.env['PROVIDER_KEYFILE'] || '')).toString()
  const provider_password = process.env['PROVIDER_PASSWORD'] || ''
  const wallet = await ethers.Wallet.fromEncryptedJson(provider_key_file, provider_password)
  let ecdh = crypto.createECDH('secp256k1');
  ecdh.setPrivateKey(Buffer.from(wallet.privateKey))
  return ecies.decrypt(ecdh.getPrivateKey(), Buffer.from(cipherText)).toString()
};
