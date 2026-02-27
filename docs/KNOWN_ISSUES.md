# Known Issues

## Transfer amount defaults to Planck

Sometimes the transfer amount is understood as Planck

## Westend transfer sometimes failes

Westend sometimes gives back `Transaction Invalid `

This is what we know from SubWallet:

```
0x67f9…7598c9 network's metadata is out of date, which may cause the transaction to fail. Update metadata using this guide or approve transaction at your own risk
```

Most likely this is related to Westend not being stable at the moment.
We did not used to have this issue previously.
Polkadot.js gives the same error as of now.

## ScenarioEngine does not traslates addresses like Alice

When evaluating, the ScenarioEngine does not translate addresses like Alice, will give failure for matching address.