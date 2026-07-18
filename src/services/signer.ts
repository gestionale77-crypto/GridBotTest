import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodeAbiParameters, parseAbiParameters, stringToHex } from 'viem';

// EIP-712 specifications for Hyperliquid Exchange API
const HYPERLIQUID_DOMAIN = {
  name: 'Exchange',
  version: '1',
  chainId: 1337, // Local custom chainId representing Hyperliquid L1
  verifyingContract: '0x0000000000000000000000000000000000000000' as const,
};

/**
 * Packs the action hash and nonce into a single message for cryptographic signing.
 * Real Hyperliquid-style signature.
 */
export function hashAction(action: any, nonce: number, vaultAddress: string | null): `0x${string}` {
  // Convert action to JSON string for hashing
  const actionJson = JSON.stringify(action);
  const actionHash = keccak256(stringToHex(actionJson));
  
  // Pack parameters: actionHash (bytes32), nonce (uint64), vaultAddress (address)
  const vault = vaultAddress || '0x0000000000000000000000000000000000000000';
  
  const encoded = encodeAbiParameters(
    parseAbiParameters('bytes32, uint64, address'),
    [actionHash, BigInt(nonce), vault as `0x${string}`]
  );
  
  return keccak256(encoded);
}

/**
 * Signs the Hyperliquid action with EIP-712 structured typed data.
 */
export async function signHyperliquidAction(
  privateKey: string,
  action: any,
  nonce: number,
  vaultAddress: string | null = null
): Promise<{ r: string; s: string; v: number; signature: string }> {
  // Safe validation of private key
  let formattedKey = privateKey;
  if (!formattedKey.startsWith('0x')) {
    formattedKey = `0x${formattedKey}`;
  }

  const account = privateKeyToAccount(formattedKey as `0x${string}`);
  const msgHash = hashAction(action, nonce, vaultAddress);

  // Sign EIP-712 Typed Data
  // Hyperliquid structured message signature uses Agent primary type or custom action hash
  const signature = await account.signTypedData({
    domain: HYPERLIQUID_DOMAIN,
    types: {
      Agent: [
        { name: 'source', type: 'string' },
        { name: 'connectionId', type: 'bytes32' },
      ],
    },
    primaryType: 'Agent',
    message: {
      source: 'b', // 'b' for build/bot
      connectionId: msgHash,
    },
  });

  // Extract r, s, v from the signature
  const r = signature.slice(0, 66) as `0x${string}`;
  const s = `0x${signature.slice(66, 130)}` as `0x${string}`;
  const v = parseInt(signature.slice(130, 132), 16);

  return {
    r,
    s,
    v,
    signature,
  };
}
