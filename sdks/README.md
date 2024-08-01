# Oraichain VRF SDK

## Generate code and docs

```bash
# build code:
cwtools build ../../oraiwasm/package/plus/vrfdkg -o packages/contracts-build/data
# build schema
cwtools build ../../oraiwasm/package/plus/vrfdkg -s
# gen code:
cwtools gents ../../oraiwasm/package/plus/vrfdkg -o packages/contracts-sdk/src
# gen doc:
yarn docs

# patch a package:
yarn patch-package @cosmjs/cosmwasm-stargate
```
