/**
 * Manual mock for @polkadot/keyring
 */
export const decodeAddress = jest.fn((address: string) => {
  if (!address || address.length === 0) {
    throw new Error('Invalid address');
  }
  return new Uint8Array(32);
});

export const encodeAddress = jest.fn((key: Uint8Array) => 
  '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'
);

