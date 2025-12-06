/**
 * Manual mock for @polkadot/util-crypto
 * 
 * This mock recognizes valid SS58 addresses used in tests
 */
const VALID_TEST_ADDRESSES = [
  '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
  '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
  '5FLSigC9HGRKVhB9F7s3C6qNK8p7tvYwDDeYNP83mZ4pzH9i',
];

export const isAddress = jest.fn((address: string) => {
  // Return true for valid test addresses or any non-empty string starting with '5' and having reasonable length
  if (!address || address.trim().length === 0) {
    return false;
  }
  
  // Check if it's one of our known test addresses
  if (VALID_TEST_ADDRESSES.includes(address)) {
    return true;
  }
  
  // For other addresses, check basic SS58 format (starts with '5' and has reasonable length)
  // Real SS58 addresses are typically 47-48 characters
  if (address.startsWith('5') && address.length >= 40 && address.length <= 50) {
    return true;
  }
  
  return false;
});

