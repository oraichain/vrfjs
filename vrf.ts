// file: ./vrf.ts
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { GasPrice } from "@cosmjs/stargate";
import { VrfdkgClient } from "@oraichain/vrf-contracts-sdk";
import { setTimeout as sleep } from "timers/promises";
import { Coin, DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { Binary, ORAI } from "@oraichain/common";
import dotenv from "dotenv";
dotenv.config();

(async () => {
  const rpc = "https://rpc.orai.io";
  const gasPrice = 0.003;
  const contractAddress =
    "orai1xfh0c0j4kefeuvxdwndarhjdvez0dtqv9heuk08u5lmz5tp8sglsan3qw5";

  // init signer
  const signer = await DirectSecp256k1HdWallet.fromMnemonic(
    process.env.MNEMONIC,
    { prefix: ORAI }
  );
  // get first account from signer
  const account = (await signer.getAccounts())[0];

  // init signClient
  const signClient = await SigningCosmWasmClient.connectWithSigner(
    rpc,
    signer,
    {
      gasPrice: GasPrice.fromString(`${gasPrice}${ORAI}`),
    }
  );

  // init contract client
  const vrfContractClient = new VrfdkgClient(
    signClient,
    account.address,
    contractAddress
  );

  // full-flow function
  const requestRandom = async (
    inputText: Binary,
    funds: Coin[] = [{ denom: "orai", amount: "1" }]
  ) => {
    // save round to check
    let round: number;
    // make request
    const response = await vrfContractClient.requestRandom(
      { input: Buffer.from(inputText).toString("base64") },
      "auto",
      null,
      funds
    );
    // get round
    const wasmEvent = response.logs[0].events.find((e) => e.type === "wasm");
    wasmEvent.attributes.forEach((attr) => {
      if (attr.key === "round") {
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

  const randomess = await requestRandom("my lucky number today");
  console.log("random result: ", randomess);
})();
