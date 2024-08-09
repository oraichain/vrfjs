# How to use VRF on Oraichain

1. Install required libraries
```sh
yarn add @cosmjs/cosmwasm-stargate @cosmjs/stargate cosmjs-utils @oraichain/vrf-contracts-sdk
```

2. Add get random function
```js
  // file: ./vrf.ts
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

  // full-flow function
  export const requestRandom = async (inputText: Binary, funds: Coin[] = [{ denom: 'orai', amount: '1' }]) => {
    // save round to check
    let round: number;
    // make request
    const response = await vrfContractClient.requestRandom({ input: Buffer.from(inputText).toString('base64') }, 'auto', null, funds);
    // get round
    const wasmEvent = response.logs[0].events.find((e) => e.type === 'wasm');
    wasmEvent.attributes.forEach((attr) => {
      if (attr.key === 'round') {
        round = +attr.value;
      }
    });

    // check result
    do {
      const roundInfo = await vrfContractClient.getRound({ round });

      // result may not be available, you have to wait until VRF contract collect enough signatures from runner
      if (roundInfo.randomness) {
        return roundInfo.randomness;
      }
      // sleep for 1 seconds
      await sleep(1e3);
    } while (true);
  };
```

3. Usage
```js
import { requestRandom } from './vrf';

requestRandom('my lucky number today').then((result) => { console.log('result:', result) });
```
