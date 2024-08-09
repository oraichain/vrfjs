import fs from "fs";
import * as dotenv from "dotenv";
import YAML from "yaml";
import Cosmos from "@oraichain/cosmosjs";
import { SimulateCosmWasmClient } from "@oraichain/cw-simulate";
import { VrfdkgClient } from "../sdks/packages/contracts-sdk/src/index";
import Runner from "../runner";
import { deployContract } from "../sdks/packages/contracts-build/src";
import { DirectSecp256k1HdWallet } from "@cosmjs/proto-signing";
import { InstantiateMsg } from "../sdks/packages/contracts-sdk/src/Vrfdkg.types";

dotenv.config({
  path: `.env${process.env.NODE_ENV ? "." + process.env.NODE_ENV : ""}`,
}).parsed;

const getCosmosHelper = () => {
  // console.log('testnet: ', process.env.TESTNET);
  const configPath = process.env.TESTNET
    ? "config-testnet.yaml"
    : "config.yaml";
  const path = process.cwd() + "/" + configPath;
  // console.log('path:', path);

  const config = YAML.parse(fs.readFileSync(path).toString());
  const cosmos = new Cosmos(config.lcd, config.chainId);
  cosmos.setBech32MainPrefix("orai");

  return cosmos;
};

(async () => {
  const senders = {
    deployer: {
      address: "orai1x2hrsfczmh9stjhpgepqnhc0ek0k6m7a74uuxd",
    },
  };
  const wallets = await Promise.all(
    new Array(2).fill(0).map((_) =>
      DirectSecp256k1HdWallet.generate(24, {
        prefix: "orai",
      })
    )
  );
  const runners = (
    await Promise.all(wallets.map((wallet) => wallet.getAccounts()))
  ).map((runner) => runner[0]);
  const cosmosHelper = getCosmosHelper();
  const runnerChildKeys = wallets.map((wallet) =>
    cosmosHelper.getChildKey(wallet.mnemonic)
  );

  const client = new SimulateCosmWasmClient({
    chainId: "Oraichain",
    bech32Prefix: "orai",
  });

  runners.map((runner) =>
    client.app.bank.setBalance(runner.address, [
      { amount: "10000000000", denom: "orai" },
    ])
  );

  const vrfContract = await deployContract(
    client,
    senders.deployer.address,
    {
      members: runners.map((runner) => ({
        address: runner.address,
        pubkey: Buffer.from(runner.pubkey).toString("base64"),
      })),
      threshold: 1,
      dealer: 2,
    } as InstantiateMsg,
    "",
    "vrfdkg"
  );

  const runnerClients = runners.map(
    (runner) =>
      new VrfdkgClient(client, runner.address, vrfContract.contractAddress)
  );

  const runnerClasses = runnerClients.map(
    (runnerClient, i) =>
      new Runner("runner" + i, runnerClient, runnerChildKeys[i], cosmosHelper)
  );

  for (let i = 0; i < runnerClasses.length; i++) {
    const runnerClass = runnerClasses[i];
    runnerClass.run((i + 1 * 2) * 2000);
  }

  for (let i = 0; i < 10; i++) {
    await new Promise((resolve) => setTimeout(resolve, 8000));
    try {
      await runnerClients[0].requestRandom(
        { input: "foo" },
        "auto",
        undefined,
        [{ amount: "1", denom: "orai" }]
      );
    } catch (error) {
      // ignore
    }
  }
})();
