import { setTimeout as sleep } from "timers/promises";
import blsdkgJs from "./pkg/blsdkg_js";
import { encrypt, decrypt, signSignature } from "./utils";
import * as bip32 from "bip32";
import Cosmos from "@oraichain/cosmosjs";
import { Member } from "@oraichain/vrf-contracts-sdk/build/Vrfdkg.types";
import { VrfdkgClient } from "@oraichain/vrf-contracts-sdk";

export default class Runner {
  runnerName!: string;
  skShare: blsdkgJs.KeyShare;
  currentMember: Member;
  members: Member[];
  address: string;

  constructor(
    name: string,
    private sdkClient: VrfdkgClient,
    private account: bip32.BIP32Interface,
    private cosmosHelper: Cosmos
  ) {
    this.runnerName = name;

    this.address = cosmosHelper.getAddress(this.account);
    return this;
  }

  async getMembers(total: number) {
    let offset = "";
    let members = [];
    do {
      // TODO: assume members are small, for big one should get 10 by 10
      const tempMembers = await this.sdkClient.getMembers({
        offset,
        limit: 5,
      });
      if (!tempMembers || tempMembers.length === 0) continue;
      members = members.concat(tempMembers);
      offset = members[members.length - 1].address;
      members = members.filter(
        (v, i, a) => a.findIndex((t) => t.index === v.index) === i
      );
      // if no more data, we also need to break
      // if (oldOffset === offset) break;
      // oldOffset = offset;
    } while (members.length < total);
    return members;
  }

  // TODO: handle get batch dealers when list is large
  async getDealers() {
    const dealers = this.members.filter((mem) => mem.shared_dealer !== null);
    return dealers;
  }

  async getSkShare(dealer: any) {
    const dealers = await this.getDealers();
    if (dealers.length !== dealer) {
      return console.log(
        `${this.runnerName}: The number of dealers is not valid, cannot verify Sk share`
      );
    }
    const commits = [];
    const rows = [];
    for (const dealer of dealers) {
      const encryptedRow = Buffer.from(
        dealer.shared_dealer.rows[this.currentMember.index],
        "base64"
      );
      const dealerPubkey = Buffer.from(dealer.pubkey, "base64");
      const commit = Buffer.from(
        dealer.shared_dealer.commits[this.currentMember.index + 1],
        "base64"
      );
      const row = decrypt(
        this.account.privateKey,
        dealerPubkey,
        commit,
        encryptedRow
      );
      commits.push(commit);
      rows.push(row);
    }

    this.skShare = blsdkgJs.get_sk_share(rows, commits);
  }

  async processDealer(threshold: number, total: number) {
    console.log(`${this.runnerName}: Process dealer share`);

    const bivars = blsdkgJs.generate_bivars(threshold, total);

    const commits: any = bivars.get_commits().map(Buffer.from);
    const rows: any = bivars.get_rows().map(Buffer.from);

    console.log(`${this.runnerName}: Member length:`, this.members.length);
    if (this.members.length !== total) {
      return console.log(
        `${this.runnerName}: Member length is not full, should not deal shares for others`
      );
    }
    // then sort members by index for sure to encrypt by their public key
    this.members.sort((a, b) => a.index - b.index);

    if (this.currentMember.shared_dealer) {
      return console.log(
        `${this.runnerName}: We are done dealer sharing, currently waiting for others to move on to the next phase`
      );
    }

    if (
      this.currentMember.pubkey !== this.account.publicKey.toString("base64")
    ) {
      return console.log(
        `${this.runnerName}: Pubkey is not equal to the member stored on the contract. Cannot be a dealer`
      );
    }

    commits[0] = commits[0].toString("base64");
    for (let i = 0; i < rows.length; ++i) {
      // no need to check pubkey the same as address, they may use their desired keypair, bydefault it is the private key
      // remember commit[0] is the sum commit
      rows[i] = encrypt(
        Buffer.from(this.members[i].pubkey, "base64"),
        this.account.privateKey,
        commits[i + 1],
        rows[i]
      ).toString("base64");
      commits[i + 1] = commits[i + 1].toString("base64");
    }

    // finaly share the dealer
    const response = await this.sdkClient.shareDealer({
      share: { commits, rows },
    });

    // log response then return
    console.log(`${this.runnerName}: `, response);
  }

  async processRow() {
    // we update public key share for smart contract to verify and keeps this skShare to sign message for each round
    const pkShare = Buffer.from(this.skShare.get_pk()).toString("base64");
    // finaly share the dealer

    const response = await this.sdkClient.shareRow({
      share: { pk_share: pkShare },
    });

    console.log(`${this.runnerName}: `, response);
  }

  async processRequest() {
    console.log(`${this.runnerName}: Process request`);

    // get current handling round
    const roundInfo = await this.sdkClient.currentHandling();

    if (!roundInfo) {
      return console.log(`${this.runnerName}: There is no round to process`);
    }

    if (
      roundInfo.sigs.find((sig) => sig.sender === this.address) &&
      !roundInfo.combined_sig
    ) {
      return console.log(
        `${this.runnerName}: You have successfully submitted your signature share, waiting to finish the round`
      );
    }
    if (roundInfo.signed_eth_combined_sig) {
      return console.log(`${this.runnerName}: The round has finished`);
    }

    // otherwise add the sig contribution from skShare
    const sig = this.skShare.sign_g2(
      Buffer.from(roundInfo.input, "base64"),
      BigInt(roundInfo.round)
    );

    // sign on the sig
    let signedSignature = "";
    if (!roundInfo.signed_eth_combined_sig && roundInfo.combined_sig) {
      signedSignature = Buffer.from(
        signSignature(
          roundInfo.randomness,
          this.cosmosHelper.getECPairPriv(this.account)
        )
      ).toString("base64");
    }

    // share the signature, more gas because the verify operation, especially the last one
    const response = await this.sdkClient.shareSig({
      share: {
        round: roundInfo.round,
        sig: Buffer.from(sig).toString("base64"),
        signed_sig: signedSignature,
      },
    });
    console.log(`${this.runnerName}: `, response, roundInfo.round);
  }

  async execute() {
    const { status, threshold, total, dealer } =
      await this.sdkClient.contractInfo();
    console.log(`${this.runnerName}: total before getting members:`, total);

    // first time or wait_for_request
    if (status !== "wait_for_request" || !this.members) {
      this.members = await this.sdkClient.getMembers({});
      console.log(`${this.runnerName}: total members: `, this.members);
      // check wherther we has done sharing ?
      this.currentMember = this.members.find(
        (m) => !m.deleted && m.address === this.address
      );
      if (!this.currentMember) {
        return console.log(`${this.runnerName}: we are not in the group`);
      }
    }
    console.log(`${this.runnerName}: status:`, status);

    switch (status) {
      case "wait_for_dealer":
        // re-init data
        return this.processDealer(threshold, total);
      case "wait_for_row":
      case "wait_for_request":
        if (!this.currentMember) {
          return console.log(`${this.runnerName}: We are not in the group`);
        }
        // skShare is changed only when members are updated
        await this.getSkShare(dealer);
        if (!this.skShare) {
          return console.log(`${this.runnerName}: row share is invalid`);
        }
        if (status === "wait_for_row") {
          if (!this.currentMember.shared_row) {
            // update shared pubkey for contract to verify sig
            await this.processRow();
            this.members = null;
          } else {
            console.log(
              `${this.runnerName}: Finished sharing row. Currently waiting for all members to share row`
            );
          }
          return;
        }
        // default process each request
        return this.processRequest();
      default:
        return console.log(`${this.runnerName}: Unknown status:`, status);
    }
  }

  async run(interval = 5000) {
    while (true) {
      await sleep(interval);
      try {
        await this.execute();
      } catch (error) {
        console.log(`${this.runnerName}: error while handling the vrf:`, error);
        this.members = null;
      }
    }
  }
}

// console.log('Oraichain VRF, version 4.0.2');
// TODO: add try catch and improve logs
