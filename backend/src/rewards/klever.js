import { config } from '../config/index.js';

/**
 * Klever blockchain interaction layer.
 *
 * Builds and broadcasts reward transactions from the configured admin wallet:
 *   - Native KLV (KTH_TOKEN_ID=KLV): plain Transfer from admin wallet balance.
 *   - KDA token (e.g. FLIPPY-3FQ0):  AssetTrigger(Mint) — admin wallet must be
 *     the token owner or have the Mint role assigned on KleverScan.
 */

async function getAdminAccount() {
  if (!config.rewards.adminMnemonic) {
    throw new Error('Reward wallet not configured — set REWARD_ADMIN_MNEMONIC or REWARD_ADMIN_PRIVATE_KEY');
  }

  // Dynamic import so startup doesn't fail if SDK is missing
  const { Account, utils } = await import('@klever/sdk-node');

  // Override the SDK's hardcoded klever.finance defaults with our configured endpoints
  utils.setProviders({
    node: config.klever.nodeUrl,
    api:  config.klever.apiUrl,
  });

  // Always create a fresh account to ensure the nonce is fetched live from the
  // blockchain. Caching the account causes "duplicated transaction" errors when
  // a previous transaction consumed the nonce (even if it failed on-chain).
  const account = new Account(config.rewards.adminMnemonic);
  await account.ready;
  return account;
}

/**
 * Send `amount` reward tokens (in minimal units) to a klv1 address.
 * Uses Transfer for native KLV, AssetTrigger(Mint) for KDA tokens.
 * Returns the Klever transaction hash.
 */
export async function kleverMintKth(recipientAddress, amount) {
  const { TransactionType, utils } = await import('@klever/sdk-node');

  const account = await getAdminAccount();

  const isNativeKlv = !config.rewards.tokenId.includes('-');

  // useMint=true  → AssetTrigger(Mint): admin wallet must own the KDA token.
  //                 Mints new supply — no balance needed, and avoids SameAccountError
  //                 when the admin and recipient are the same wallet.
  // useMint=false → Transfer: works for KLV, third-party KDA tokens, or any token
  //                 the admin simply holds. Requires sufficient wallet balance.
  const contract = (!isNativeKlv && config.rewards.useMint)
    ? {
        type:    TransactionType.AssetTrigger,
        payload: { triggerType: 0, assetId: config.rewards.tokenId, receiver: recipientAddress, amount },
      }
    : {
        type:    TransactionType.Transfer,
        payload: isNativeKlv
          ? { amount, receiver: recipientAddress }
          : { amount, kda: config.rewards.tokenId, receiver: recipientAddress },
      };

  let tx;
  try {
    tx = await account.buildTransaction([contract], [], { node: config.klever.nodeUrl });
  } catch (err) {
    console.error('[klever] buildTransaction failed:', err?.message ?? err);
    throw new Error(`Failed to build transaction: ${err?.message ?? err}`);
  }

  const signed = await account.signTransaction(tx);

  let result;
  try {
    result = await utils.broadcastTransactions([signed]);
  } catch (err) {
    console.error('[klever] broadcastTransactions failed:', err?.message ?? err);
    throw new Error(`Failed to broadcast transaction: ${err?.message ?? err}`);
  }

  console.log('[klever] broadcast result:', JSON.stringify(result));

  if (result?.error) {
    throw new Error(`Klever broadcast failed: ${result.error}`);
  }

  // SDK returns { data: { txsHashes: [...] } } or { txsHashes: [...] } depending on version
  const txHash = result?.data?.txsHashes?.[0]
    || result?.txsHashes?.[0]
    || result?.data?.txHash
    || result?.txHash;
  if (!txHash) throw new Error(`Broadcast succeeded but no tx hash returned. Result: ${JSON.stringify(result)}`);

  return txHash;
}

/**
 * Fetch raw account data from the Klever API service.
 */
async function fetchAccountData(address) {
  const resp = await fetch(`${config.klever.apiUrl}/address/${address}`);
  if (!resp.ok) throw new Error(`Klever API ${resp.status}`);
  const data = await resp.json();
  return data?.data?.account || {};
}

/**
 * Query a klv1 address's token balance via the Klever API.
 * Handles both native KLV (no dash in tokenId) and KDA tokens (e.g. KTH-A1B2C3).
 */
export async function getKthBalance(address) {
  try {
    const acct = await fetchAccountData(address);
    const isNativeKlv = !config.rewards.tokenId.includes('-');
    return isNativeKlv
      ? (acct.balance ?? 0)
      : (acct.assets?.[config.rewards.tokenId]?.balance ?? 0);
  } catch {
    return 0;
  }
}

/**
 * Return the reward admin wallet address, its configured token balance,
 * and its native KLV balance (needed to pay transaction fees).
 */
export async function getAdminWalletInfo() {
  if (!config.rewards.adminMnemonic) {
    return { configured: false, address: null, tokenBalance: 0, klvBalance: 0 };
  }

  const account = await getAdminAccount();
  const address = typeof account.getAddress === 'function'
    ? account.getAddress()
    : (account.address ?? null);

  if (!address) {
    return { configured: true, address: null, tokenBalance: 0, klvBalance: 0 };
  }

  try {
    const acct         = await fetchAccountData(address);
    const isNativeKlv  = !config.rewards.tokenId.includes('-');
    const tokenBalance = isNativeKlv
      ? (acct.balance ?? 0)
      : (acct.assets?.[config.rewards.tokenId]?.balance ?? 0);

    return {
      configured:   true,
      address,
      tokenBalance,
      klvBalance:   acct.balance ?? 0,
    };
  } catch (err) {
    console.error('[reward-wallet] balance fetch failed:', err.message);
    return { configured: true, address, tokenBalance: 0, klvBalance: 0 };
  }
}
