require("dotenv").config();
const Cosmjs = require("./cosmjs");

(async (input = "foo") => {
  const rpc = "https://rpc.orai.io";
  const wallet = new Cosmjs("Oraichain", rpc, "", process.env.MNEMONIC);
  const res = await wallet.execute(
    "orai1yy6czky5yspnret27esxwud5x6gv8t84sgxq3ehyyfz88p3r3qaslqzwsy",
    {
      request_random: {
        input: btoa(input),
      },
    },
    [{ denom: "orai", amount: "1" }]
  );

  console.log("response: %o", res);
})();
