export type Uint128 = string;
export type Binary = string;
export interface InstantiateMsg {
  dealer?: number | null;
  fee?: Coin | null;
  members: MemberMsg[];
  threshold: number;
}
export interface Coin {
  amount: Uint128;
  denom: string;
}
export interface MemberMsg {
  address: string;
  pubkey: Binary;
}
export type ExecuteMsg = {
  share_dealer: {
    share: SharedDealerMsg;
  };
} | {
  share_row: {
    share: SharedRowMsg;
  };
} | {
  request_random: {
    input: Binary;
  };
} | {
  share_sig: {
    share: ShareSigMsg;
  };
} | {
  update_fees: {
    fee: Coin;
  };
} | {
  reset: {
    members?: MemberMsg[] | null;
    threshold?: number | null;
  };
} | {
  force_next_round: {};
};
export interface SharedDealerMsg {
  commits: Binary[];
  rows: Binary[];
}
export interface SharedRowMsg {
  pk_share: Binary;
}
export interface ShareSigMsg {
  round: number;
  sig: Binary;
  signed_sig: Binary;
}
export type QueryMsg = {
  contract_info: {};
} | {
  get_round: {
    round: number;
  };
} | {
  get_member: {
    address: string;
  };
} | {
  get_members: {
    limit?: number | null;
    offset?: string | null;
    order?: number | null;
  };
} | {
  latest_round: {};
} | {
  get_rounds: {
    limit?: number | null;
    offset?: number | null;
    order?: number | null;
  };
} | {
  current_handling: {};
} | {
  verify_round: number;
};
export interface MigrateMsg {}
export type SharedStatus = "wait_for_dealer" | "wait_for_row" | "wait_for_request";
export interface Config {
  dealer: number;
  fee?: Coin | null;
  shared_dealer: number;
  shared_row: number;
  status: SharedStatus;
  threshold: number;
  total: number;
}
export interface DistributedShareData {
  combined_pubkey?: Binary | null;
  combined_sig?: Binary | null;
  input: Binary;
  randomness?: Binary | null;
  round: number;
  signed_eth_combined_sig?: Binary | null;
  signed_eth_pubkey?: Binary | null;
  sigs: ShareSig[];
}
export interface ShareSig {
  index: number;
  sender: string;
  sig: Binary;
}
export interface Member {
  address: string;
  deleted: boolean;
  index: number;
  pubkey: Binary;
  shared_dealer?: SharedDealerMsg | null;
  shared_row?: SharedRowMsg | null;
}
export type ArrayOfMember = Member[];
export type ArrayOfDistributedShareData = DistributedShareData[];
export type Boolean = boolean;