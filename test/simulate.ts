import { readFileSync } from 'node:fs';
import fs from 'fs';
import * as dotenv from 'dotenv';
import YAML from 'yaml';
import Cosmos from '@oraichain/cosmosjs';
import { SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import { VrfdkgClient } from '../sdks/packages/contracts-sdk/src/index';
import Runner from '../runner';

dotenv.config({
  path: `.env${process.env.NODE_ENV ? "." + process.env.NODE_ENV : ""}`,
}).parsed;

const getCosmosHelper = () => {
  // console.log('testnet: ', process.env.TESTNET);
  const configPath = process.env.TESTNET ? 'config-testnet.yaml' : 'config.yaml';
  const path = process.cwd() + '/' + configPath;
  // console.log('path:', path);

  const config = YAML.parse(fs.readFileSync(path).toString());
  const cosmos = new Cosmos(config.lcd, config.chainId);
  cosmos.setBech32MainPrefix('orai');

  return cosmos;
};

const deployVrfContract = async (client: any, creator: string, contractConfig): Promise<string> => {
  const { codeId } = await client.upload(
    creator,
    readFileSync('/Users/quanpt/code/orai/vrfjs/sdks/packages/contracts-build/data/vrfdkg.wasm'),
    'auto'
  );

  const { contractAddress } = await client.instantiate(
    creator,
    codeId,
    contractConfig,
    'vrfdkg',
    'auto'
  );
  return contractAddress;
};

(async () => {
  const senders = {
    deployer: {
      address: 'orai1x2hrsfczmh9stjhpgepqnhc0ek0k6m7a74uuxd',
    },
    runner1: {
      address: 'orai1kke6jygmtdnxq3x04zargy742ez603wjfx0qkk',
      pubkey: 'A08ecADv/0W9vi6UlOnJTrZDpYTWLehKh1F7tjFLod3p',
    },
    runner2: {
      address: 'orai1pp3knexxjh39a6vthl0qqxhucnx090aflfrhq8',
      pubkey: 'Aw/A3Nx2VmoQbHTiy260yq0SAELEtJH5+k+JqC8NP6YF',
    },
  };
  const cosmosHelper = getCosmosHelper();
  const runner1Account = cosmosHelper.getChildKey(process.env.MNEMONIC1);
  const runner2Account = cosmosHelper.getChildKey(process.env.MNEMONIC2);

  const client = new SimulateCosmWasmClient({
    chainId: 'Oraichain',
    bech32Prefix: 'orai',
  });

  const contractAddress = await deployVrfContract(client, senders.deployer.address, {
    members: [senders.runner1, senders.runner2],
    threshold: 2,
    dealer: 2,
  });

  const deployerVrfClient = new VrfdkgClient(client, senders.deployer.address, contractAddress);
  const runner1VrfClient = new VrfdkgClient(client, senders.runner1.address, contractAddress);
  const runner2VrfClient = new VrfdkgClient(client, senders.runner2.address, contractAddress);

  const runner1 = new Runner('runner1', runner1VrfClient, runner1Account, cosmosHelper);
  const runner2 = new Runner('runner2', runner2VrfClient, runner2Account, cosmosHelper);

  runner1.run();
  runner2.run();
})();
