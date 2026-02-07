# Ascend Bridge EVM – Vault + Listener

A minimal custody-style vault + indexer system running on a BuildBear EVM sandbox.

It includes:
- Solidity ETH + ERC20 vault
- Backend withdrawal authority (server-signed)
- Event indexer (listener)
- Supabase ledger persistence
- Secure withdrawal API
- Automated deployment + test scripts

---

## 📁 Folder Structure

```
ascend-bridge-evm/
│
├─ contracts/                 # Solidity smart contracts
│   ├─ OwnerWithdrawVault.sol
│   └─ MockUSDT.sol
│
├─ scripts/                   # Hardhat scripts
│   ├─ deployAll.ts           # deploy contract both token and vault
│   ├─ deployToken.ts         # deploy / mint 1B TEST USDT Token
│   ├─ deployVault.ts         # deploy vault contract
│   └─ utils.ts
│
├─ deployments/
│   └─ addresses.json         # Auto‑generated addresses .json file
│
├─ listener/                  # Indexer listening api service (separate package)
│   ├─ dist/*
│   │
│   ├─ src/
│   │   ├─ index.ts           
│   │   ├─ listener.ts        
│   │   └─ withdraw.ts 
│   │
│   ├─ utils/
│   │   ├─ index.ts           
│   │   ├─ logger.ts        
│   │   └─ security.ts 
│   │
│   ├─ package.json
│   ├─ .node-version
│   ├─ pnpm-lock.yaml
│   └─ tsconfig.json
│
├─ test/
│   ├─ testERC_20.ts
│   └─ testETH.ts
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
- Only vault owner can withdraw

Listener:
- Reads blockchain events
- Normalizes to `DEPOSIT` / `WITHDRAW`
- Saves into Supabase DB

Backend API:
- Verifies signed withdrawal request
- Checks DB balance
- Prevents parallel withdrawals
- Signs blockchain transaction

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

Important ENV's required:
- TREASURY_OWNER_PK
- TREASURY_OWNER_ADDRESS

Install dependencies:

```bash
pnpm install
```

---

## 🔐 Environment Variables (.env)

Create TWO `.env` files.

---

### Root `.env` (Hardhat + scripts)

```bash
cp .env.example .env
```

---

### listener/.env (Indexer backend)

```bash
cp .env.example .env
```

---

## 🗄️ Database Schema (Supabase)

Run once in SQL editor:

```sql

create table public."ascend-accounts" (
  address text primary key,
  balance number 
  tokens jsonb not null default '{}'::jsonb,
  created_at timestamp with time zone default now()
);

create table public.evm_birdge_events (
  id uuid primary key default gen_random_uuid(),
  contract_address text not null,
  account_address text not null references public."ascend-accounts"(address),
  tx_hash text not null,
  log_index integer not null,
  event_type text not null check (event_type in ('DEPOSIT','WITHDRAW')),
  from_address text,
  to_address text,
  token text,
  amount numeric not null,
  block_number bigint not null,
  metadata jsonb,
  created_at timestamp with time zone default now()
);
```

---

## ⛽ Fund Wallets

Fund via BuildBear faucet:

Treasury: ≥ 5 ETH\
User: ≥ 1 ETH

---

## 🚀 Running the Project

### 1️⃣ Deploy contracts

```
pnpm run deploy
```

This will:
- Deploy USDT test Token (minted to TEST_USER_ADDRESS)
- Deploy Vault
- Save addresses to `deployments/addresses.json`
- Automatically sends **1,000,000 TEST USDT** to the test user.

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
pnpm run test:eth
```

Tests include:
- ETH deposit
- ETH withdraw


```
pnpm run test:usdt
```

Tests include:
- USDT deposit
- USDT withdraw
---

## 🧪 Expected Flow

### Deposit:

User → Contract → Event → Listener → DB balance increases

### Withdraw:

User → API → Verified → Contract → Event → Listener → DB balance decreases

---


## 🧩 Notes

- Listener uses HTTP polling (BuildBear has no WebSocket support)
- DB acts only as mirror — funds security enforced on‑chain
- Token column NULL means native ETH (evm_brige_events)
- Contract is settlement layer only

---

## 📌 Summary

This project replicates a simplified exchange custody model:

Blockchain → Settlement
Indexer → Accounting
Database → Ledger
Backend → Withdrawal Authority

---

## 👨‍💻 Author / Developed By

**Shubhanshu Saxena**  
GitHub: https://github.com/shubhu2002

---


## 🧠 Project Purpose

Educational demonstration of how real exchanges, bridges and custodial systems safely manage balances without trusting wallet state.

---
