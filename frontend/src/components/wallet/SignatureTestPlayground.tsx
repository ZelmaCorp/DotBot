import React, { useState } from 'react';
import { web3Accounts, web3Enable } from '@polkadot/extension-dapp';
import { signatureVerify } from '@polkadot/util-crypto';
import { decodeAddress } from '@polkadot/keyring';

/**
 * SIGNATURE TEST PLAYGROUND
 * Simple component to test Polkadot wallet signature flow step-by-step
 */
const SignatureTestPlayground: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<any>(null);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');

  const addLog = (message: string, data?: any) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
    const logMessage = data 
      ? `[${timestamp}] ${message}\n${JSON.stringify(data, null, 2)}`
      : `[${timestamp}] ${message}`;
    setLogs(prev => [...prev, logMessage]);
    console.log(message, data || '');
  };

  const clearLogs = () => {
    setLogs([]);
    setTestResult('idle');
  };

  // STEP 1: Enable wallet and get accounts
  const handleEnableWallet = async () => {
    clearLogs();
    addLog('🔌 Step 1: Enabling wallet...');
    
    try {
      const extensions = await web3Enable('DotBot Test');
      addLog('✅ Extensions enabled', { 
        count: extensions.length,
        names: extensions.map(e => e.name)
      });

      const accts = await web3Accounts();
      addLog('✅ Accounts found', { count: accts.length });
      
      setAccounts(accts);
      if (accts.length > 0) {
        setSelectedAccount(accts[0]);
        addLog('✅ Auto-selected first account', {
          address: accts[0].address,
          name: accts[0].meta?.name,
          type: accts[0].type
        });
      }
    } catch (error: any) {
      addLog('❌ Error enabling wallet', { error: error.message });
      setTestResult('error');
    }
  };

  // STEP 2: Test basic signing with type: 'payload'
  const handleTestSigningPayload = async () => {
    if (!selectedAccount) {
      addLog('❌ No account selected');
      return;
    }

    clearLogs();
    addLog('🔐 Step 2: Testing signature with type: "payload"');
    
    try {
      // Get extension
      const extensions = await web3Enable('DotBot Test');
      const extension = extensions.find(e => e.name === selectedAccount.meta.source);
      
      if (!extension || !extension.signer || !extension.signer.signRaw) {
        throw new Error('No signer available');
      }

      addLog('✅ Signer found', { extension: extension.name });

      // Create simple message
      const timestamp = Date.now();
      const message = `Test Message\nTimestamp: ${timestamp}\nAddress: ${selectedAccount.address}`;
      addLog('📝 Message created', { message, length: message.length });

      // Sign with type: 'payload'
      addLog('🔏 Requesting signature with type: "payload"...');
      const signResult = await extension.signer.signRaw({
        address: selectedAccount.address,
        data: message,
        type: 'payload'
      });

      addLog('✅ Signature received', {
        signatureLength: signResult.signature.length,
        signature: signResult.signature,
        signaturePreview: signResult.signature.substring(0, 30) + '...'
      });

      // Verify signature (no modifications)
      addLog('🔍 Verifying signature (no modifications)...');
      const verificationResult = signatureVerify(
        message,
        signResult.signature,
        selectedAccount.address
      );

      addLog('🔍 Verification result', {
        isValid: verificationResult.isValid,
        crypto: verificationResult.crypto,
        publicKeyLength: verificationResult.publicKey?.length
      });

      // Compare public keys
      const expectedPublicKey = decodeAddress(selectedAccount.address);
      const verifiedPublicKey = verificationResult.publicKey;
      
      if (verifiedPublicKey) {
        const keysMatch = expectedPublicKey.length === verifiedPublicKey.length &&
          expectedPublicKey.every((b, i) => b === verifiedPublicKey[i]);
        
        addLog('🔑 Public key comparison', {
          expectedLength: expectedPublicKey.length,
          verifiedLength: verifiedPublicKey.length,
          keysMatch
        });

        if (verificationResult.isValid && keysMatch) {
          addLog('✅ SUCCESS! Signature verification passed!');
          setTestResult('success');
        } else {
          addLog('❌ FAILED: Signature verification failed', {
            isValid: verificationResult.isValid,
            keysMatch
          });
          setTestResult('error');
        }
      }
    } catch (error: any) {
      addLog('❌ Error during signing', { error: error.message, stack: error.stack });
      setTestResult('error');
    }
  };

  // STEP 3: Test basic signing with type: 'bytes'
  const handleTestSigningBytes = async () => {
    if (!selectedAccount) {
      addLog('❌ No account selected');
      return;
    }

    clearLogs();
    addLog('🔐 Step 3: Testing signature with type: "bytes"');
    
    try {
      const extensions = await web3Enable('DotBot Test');
      const extension = extensions.find(e => e.name === selectedAccount.meta.source);
      
      if (!extension || !extension.signer || !extension.signer.signRaw) {
        throw new Error('No signer available');
      }

      addLog('✅ Signer found', { extension: extension.name });

      const timestamp = Date.now();
      const message = `Test Message\nTimestamp: ${timestamp}\nAddress: ${selectedAccount.address}`;
      addLog('📝 Message created', { message, length: message.length });

      // Sign with type: 'bytes'
      addLog('🔏 Requesting signature with type: "bytes"...');
      const signResult = await extension.signer.signRaw({
        address: selectedAccount.address,
        data: message,
        type: 'bytes'
      });

      addLog('✅ Signature received', {
        signatureLength: signResult.signature.length,
        signature: signResult.signature,
        signaturePreview: signResult.signature.substring(0, 30) + '...'
      });

      // Verify signature (no modifications)
      addLog('🔍 Verifying signature (no modifications)...');
      const verificationResult = signatureVerify(
        message,
        signResult.signature,
        selectedAccount.address
      );

      addLog('🔍 Verification result', {
        isValid: verificationResult.isValid,
        crypto: verificationResult.crypto,
        publicKeyLength: verificationResult.publicKey?.length
      });

      // Compare public keys
      const expectedPublicKey = decodeAddress(selectedAccount.address);
      const verifiedPublicKey = verificationResult.publicKey;
      
      if (verifiedPublicKey) {
        const keysMatch = expectedPublicKey.length === verifiedPublicKey.length &&
          expectedPublicKey.every((b, i) => b === verifiedPublicKey[i]);
        
        addLog('🔑 Public key comparison', {
          expectedLength: expectedPublicKey.length,
          verifiedLength: verifiedPublicKey.length,
          keysMatch
        });

        if (verificationResult.isValid && keysMatch) {
          addLog('✅ SUCCESS! Signature verification passed!');
          setTestResult('success');
        } else {
          addLog('❌ FAILED: Signature verification failed', {
            isValid: verificationResult.isValid,
            keysMatch
          });
          setTestResult('error');
        }
      }
    } catch (error: any) {
      addLog('❌ Error during signing', { error: error.message });
      setTestResult('error');
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '1200px', 
      margin: '0 auto',
      fontFamily: 'monospace'
    }}>
      <h1 style={{ marginBottom: '20px' }}>🧪 Polkadot Signature Test Playground</h1>
      
      {/* Controls */}
      <div style={{ 
        display: 'flex', 
        gap: '10px', 
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={handleEnableWallet}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          1️⃣ Enable Wallet
        </button>

        <button
          onClick={handleTestSigningPayload}
          disabled={!selectedAccount}
          style={{
            padding: '10px 20px',
            backgroundColor: selectedAccount ? '#2196F3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: selectedAccount ? 'pointer' : 'not-allowed'
          }}
        >
          2️⃣ Test type: "payload"
        </button>

        <button
          onClick={handleTestSigningBytes}
          disabled={!selectedAccount}
          style={{
            padding: '10px 20px',
            backgroundColor: selectedAccount ? '#FF9800' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: selectedAccount ? 'pointer' : 'not-allowed'
          }}
        >
          3️⃣ Test type: "bytes"
        </button>

        <button
          onClick={clearLogs}
          style={{
            padding: '10px 20px',
            backgroundColor: '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🗑️ Clear Logs
        </button>
      </div>

      {/* Account Selection */}
      {accounts.length > 0 && (
        <div style={{ 
          marginBottom: '20px',
          padding: '15px',
          backgroundColor: '#f5f5f5',
          borderRadius: '4px'
        }}>
          <h3>Selected Account:</h3>
          <select
            value={selectedAccount?.address || ''}
            onChange={(e) => {
              const account = accounts.find(a => a.address === e.target.value);
              setSelectedAccount(account);
              addLog('✅ Account switched', {
                address: account?.address,
                name: account?.meta?.name
              });
            }}
            style={{
              padding: '8px',
              width: '100%',
              fontSize: '14px'
            }}
          >
            {accounts.map((account, idx) => (
              <option key={idx} value={account.address}>
                {account.meta?.name || 'Unnamed'} - {account.address.slice(0, 8)}...{account.address.slice(-8)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Test Result Banner */}
      {testResult !== 'idle' && (
        <div style={{
          padding: '15px',
          marginBottom: '20px',
          backgroundColor: testResult === 'success' ? '#4CAF50' : '#f44336',
          color: 'white',
          borderRadius: '4px',
          fontSize: '18px',
          fontWeight: 'bold',
          textAlign: 'center'
        }}>
          {testResult === 'success' ? '✅ TEST PASSED!' : '❌ TEST FAILED'}
        </div>
      )}

      {/* Logs */}
      <div style={{
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        padding: '20px',
        borderRadius: '4px',
        maxHeight: '600px',
        overflowY: 'auto',
        fontSize: '12px',
        lineHeight: '1.5'
      }}>
        <h3 style={{ color: '#4ec9b0', marginTop: 0 }}>Console Logs:</h3>
        {logs.length === 0 ? (
          <div style={{ color: '#888' }}>No logs yet. Click a button above to start testing.</div>
        ) : (
          logs.map((log, idx) => (
            <div 
              key={idx} 
              style={{ 
                marginBottom: '10px',
                paddingBottom: '10px',
                borderBottom: '1px solid #333'
              }}
            >
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{log}</pre>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default SignatureTestPlayground;

