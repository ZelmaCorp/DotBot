/**
 * Manual mock for @polkadot/util-crypto
 */
export const isAddress = jest.fn((address: string) => {
  // Simple mock - valid addresses are non-empty strings starting with '5'
  return address && address.length > 0 && address.startsWith('5');
});

