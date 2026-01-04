/**
 * Signature Verification Test
 * 
 * Testing basic assumptions about signatureVerify behavior
 */

import { signatureVerify } from '@polkadot/util-crypto';
import { stringToHex } from '@polkadot/util';

// Test 1: What format does signatureVerify expect for the message?
console.log('=== TEST 1: Message Format ===');
const testMessage = 'Hello World';
const testMessageHex = stringToHex(testMessage);

console.log('Original message:', testMessage);
console.log('Hex-encoded message:', testMessageHex);
console.log('Message type:', typeof testMessage);
console.log('Hex type:', typeof testMessageHex);

// Test 2: What happens with different signature formats?
console.log('\n=== TEST 2: Signature Format ===');
// Raw 64 bytes = 130 hex chars (0x + 128 hex digits)
const rawSignature = '0x' + 'a'.repeat(128); // Placeholder
console.log('Raw signature (130 chars):', rawSignature);
console.log('Raw signature length:', rawSignature.length);

// With prefix = 132 hex chars (0x + 1 byte prefix + 64 bytes)
const prefixedSignature = '0x01' + 'a'.repeat(128);
console.log('Prefixed signature (132 chars):', prefixedSignature);
console.log('Prefixed signature length:', prefixedSignature.length);

// Test 3: What does signatureVerify actually do?
// We need to test with a REAL signature from the wallet
// But we can check what parameters it accepts

console.log('\n=== TEST 3: signatureVerify Function Signature ===');
console.log('signatureVerify function:', signatureVerify);
console.log('Expected parameters: (message, signature, address)');

// Test 4: Let's create a minimal test case
// We'll need to:
// 1. Get a real signature from wallet
// 2. Try verifying with original message
// 3. Try verifying with hex message
// 4. Try with and without prefix

export function testSignatureVerification(
  message: string,
  signature: string,
  address: string,
  accountType: 'sr25519' | 'ed25519' | 'ecdsa'
) {
  console.log('\n=== SIGNATURE VERIFICATION TEST ===');
  console.log('Input message:', message);
  console.log('Input signature:', signature);
  console.log('Input address:', address);
  console.log('Account type:', accountType);
  console.log('Signature length:', signature.length);
  
  const messageHex = stringToHex(message);
  
  // Test Case 1: Original message, raw signature
  console.log('\n--- Test 1: Original message, raw signature ---');
  try {
    const result1 = signatureVerify(message, signature, address);
    console.log('Result 1:', {
      isValid: result1.isValid,
      crypto: result1.crypto,
      isWrapped: result1.isWrapped
    });
  } catch (error) {
    console.log('Error 1:', error);
  }
  
  // Test Case 2: Hex message, raw signature
  console.log('\n--- Test 2: Hex message, raw signature ---');
  try {
    const result2 = signatureVerify(messageHex, signature, address);
    console.log('Result 2:', {
      isValid: result2.isValid,
      crypto: result2.crypto,
      isWrapped: result2.isWrapped
    });
  } catch (error) {
    console.log('Error 2:', error);
  }
  
  // Test Case 3: Original message, prefixed signature
  console.log('\n--- Test 3: Original message, prefixed signature ---');
  let prefixedSig = signature;
  if (signature.length === 130) {
    const prefix = accountType === 'sr25519' ? '0x01' : 
                   accountType === 'ed25519' ? '0x00' : '0x02';
    prefixedSig = prefix + signature.slice(2);
  }
  try {
    const result3 = signatureVerify(message, prefixedSig, address);
    console.log('Result 3:', {
      isValid: result3.isValid,
      crypto: result3.crypto,
      isWrapped: result3.isWrapped
    });
  } catch (error) {
    console.log('Error 3:', error);
  }
  
  // Test Case 4: Hex message, prefixed signature
  console.log('\n--- Test 4: Hex message, prefixed signature ---');
  try {
    const result4 = signatureVerify(messageHex, prefixedSig, address);
    console.log('Result 4:', {
      isValid: result4.isValid,
      crypto: result4.crypto,
      isWrapped: result4.isWrapped
    });
  } catch (error) {
    console.log('Error 4:', error);
  }
  
  return {
    message,
    messageHex,
    signature,
    prefixedSig,
    address,
    accountType
  };
}


