# Ascend Bridge EVM – Vault + Listener

A minimal custody-style vault + indexer system running on a BuildBear EVM sandbox.

It includes:
- Solidity ETH + ERC20 vault
- Event indexer (listener)
- Supabase persistence
- Automated deployment + test scripts

---

## 📁 Folder Structure

```
ascend-bridge-evm/
│
├─ contracts/                 # Solidity smart contracts
│   ├─ OwnerWithdrawVault.sol
│   └─ TestToken.sol
│
├─ scripts/                   # Hardhat scripts
│   ├─ deploy.ts              # deploy contract
│   ├─ deployToken.ts         # deploy / mint TEST Token
│   └─ utils.ts
│
├─ deployments/
│   └─ addresses.json         # Auto‑generated contract addresses
│
├─ listener/                  # Indexer listening api service (separate package)
│   ├─ dist/
│   │   ├─ index.js
│   │   ├─ tokenMetadata.js
│   │   └─ updateAccountTokens.js
│   ├─ src/
│   │   ├─ index.ts
│   │   ├─ tokenMetadata.ts
│   │   └─ updateAccountTokens.ts
│   ├─ package.json
│   ├─ .node-version
│   ├─ pnpm-lock.yaml
│   └─ tsconfig.json
│
├─ test/
│   └─ fullVaultTest.ts
│ 
├─ hardhat.config.ts
├─ package.json
├─ pnpm-lock.yaml
├─ README.md
└─ tsconfig.json
```

---

## 🧠 What This Project Does

Vault Contract:
- Anyone can deposit ETH or ERC20 tokens
- Only owner can withdraw

Listener:
- Reads blockchain events
- Normalizes to `DEPOSIT` / `WITHDRAW`
- Saves into Supabase DB

Database becomes a **ledger mirror** of the vault.

---

## ⚙️ Prerequisites

Install locally:

- Node.js >= 18
- pnpm >= 8
- Git

Accounts required:

- BuildBear sandbox (EVM)
- Supabase project

Install dependencies:

```bash
pnpm install
```

---

## 🔐 Environment Variables (.env)

Create TWO `.env` files.

---

### Root `.env` (Hardhat + scripts)

```
BUILDBEAR_HTTP_RPC=https://rpc.buildbear.io/your-sandbox
CHAIN_ID=1337 (Mainnet) / 31337(Testnet)
BUILDBEAR_MNEMONIC="your sandbox mnemonic words"
```

---

### listener/.env (Indexer backend)

```
BUILDBEAR_HTTP_RPC=https://rpc.buildbear.io/your-sandbox
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

⚠️ Must use **service_role** key — anon will fail inserts.

---

## 🗄️ Database Schema (Supabase)

Run once in SQL editor:

```sql
create table evm_events (
  id uuid primary key default gen_random_uuid(),
  contract_address text,
  tx_hash text,
  event_type text,
  from_address text,
  to_address text,
  token text,
  amount numeric,
  block_number bigint,
  created_at timestamp default now()
);
```

---

## 🚀 Running the Project

### 1️⃣ Deploy contracts

```
pnpm run setup
```

This will:
- Deploy TestToken (minted to user)
- Deploy Vault
- Save addresses to `deployments/addresses.json`

---

### 2️⃣ Start listener

```
pnpm run listener
```

Listener polls chain and writes events to DB.
Note : keep the terminal running

---

### 3️⃣ Run full integration test

```
pnpm run test:vault
```

Tests include:
- ETH deposit
- ETH withdraw
- Non‑owner withdraw (fail)
- Insufficient withdraw (fail)
- ERC20 deposit
- ERC20 withdraw
- ERC20 insufficient withdraw (fail)

---

## 🧪 Expected Flow

1. Test script sends transactions
2. Vault emits events
3. Listener captures events
4. Supabase table fills

Final DB should contain normalized rows:

| event_type | token | meaning |
|---------|------|------|
| DEPOSIT | null | ETH deposit |
| WITHDRAW | null | ETH withdraw |
| DEPOSIT | token addr | ERC20 deposit |
| WITHDRAW | token addr | ERC20 withdraw |

---

## 🛠 Useful Commands

| Command | Purpose |
|------|------|
| pnpm run setup | Deploy contracts |
| pnpm run listener | Start indexer |
| pnpm run test:vault | Run full test |
| pnpm install | Install deps |

---

## 🧩 Notes

- Listener uses HTTP polling (BuildBear has no WebSocket support)
- DB acts only as mirror — funds security enforced on‑chain
- Token column NULL means native ETH

---

## 📌 Summary

You now have a reproducible local blockchain indexer stack:

Contract → Events → Listener → Database

This mirrors how production custody/indexer systems operate.

