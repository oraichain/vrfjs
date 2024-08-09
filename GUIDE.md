# How to use VRF on Oraichain
```js
  import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
  import { GasPrice } from '@cosmjs/stargate';
  import { getOfflineSignerAmino } from 'cosmjs-utils';
  import { VrfdkgClient } from '@oraichain/vrf-contracts-sdk';

  const rpc = 'https://rpc.orai.io';
  const gasPrice = 0.003;
  const denom = 'orai'
  const prefix = 'orai';
  const contractAddress = 'orai1xfh0c0j4kefeuvxdwndarhjdvez0dtqv9heuk08u5lmz5tp8sglsan3qw5';

  // init signer
  const signer = await getOfflineSignerAmino({
    mnemonic: process.env.MNEMONIC || '',
    chain: {
      bech32_prefix: prefix,
      slip44: 118,
    },
  });
  // get first account from signer
  const account = (await signer.getAccounts())[0];

  // init signClient
  const signClient = await SigningCosmWasmClient.connectWithSigner(rpc, signer, {
    gasPrice: GasPrice.fromString(`${gasPrice}${denom}`),
  });


  // init contract client
  const vrfContractClient = new VrfdkgClient(signClient, account.address, contractAddress);

  // save round to check
  let round: number;
  // make request
  const response = await vrfContractClient.requestRandom({ input });
  // get round
  const wasmEvent = response.logs[0].events.find((e) => e.type === 'wasm');
  wasmEvent.attributes.forEach((attr) => {
    if (attr.key === 'round') {
      round = +attr.value;
    }
  });

  // check result
  const result = await vrfContractClient.getRound({ round });
  const { randomness } = result;
  console.log('randomness:', randomness);
  // NOTE: Result may not be available, you have to wait until VRF contract collect enough signatures from runner
```
