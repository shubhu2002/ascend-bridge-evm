import { Contract, ethers, parseUnits, Wallet } from 'ethers';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

export const supabase = createClient(
	process.env.SUPABASE_URL!,
	process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

type EventType = 'DEPOSIT' | 'WITHDRAW';

const cache = new Map<string, any>();

export async function getMetadata(provider: ethers.Provider, token?: string) {
	// Native ETH
	if (!token) {
		return {
			symbol: 'ETH',
			decimals: 18,
			contract_type: 'ETH',
		};
	}

	let meta = cache.get(token);
	if (meta) return meta;

	const erc20 = new ethers.Contract(
		token,
		[
			'function symbol() view returns(string)',
			'function decimals() view returns(uint8)',
		],
		provider,
	);

	let symbol = 'TOKEN';
	let decimals = 18;

	try {
		symbol = await erc20.symbol();
		decimals = await erc20.decimals();
	} catch {
		console.log('⚠ Could not fetch token metadata:', token);
	}

	meta = {
		symbol,
		decimals: Number(decimals),
		contract_type: 'ERC_20',
	};

	cache.set(token, meta);
	return meta;
}

export async function ensureAccountExists(address: string) {
	const { data } = await supabase
		.from('ascend-accounts')
		.select('address')
		.eq('address', address)
		.maybeSingle();

	if (data) return;

	const { error } = await supabase.from('ascend-accounts').insert({
		address,
		tokens: {},
		created_at: new Date().toISOString(),
	});

	if (error && error.code !== '23505') {
		throw error;
	}

	console.log('🆕 Created account:', address);
}

export async function applyAccountDelta(
	address: string,
	token: string | null,
	amount: bigint,
	type: EventType,
	provider?: ethers.Provider,
) {
	console.log('provider exists?', !!provider);
	const tokenKey = token ?? 'ETH';
	const delta = type === 'DEPOSIT' ? amount : -amount;
	const { data, error } = await supabase
		.from('ascend-accounts')
		.select('tokens')
		.eq('address', address)
		.single();

	if (error) throw error;

	const tokens = data?.tokens ?? {};

	if (
		!tokens[tokenKey] ||
		!tokens[tokenKey].symbol ||
		tokens[tokenKey].decimals === undefined
	) {
		console.log('metadata fetch');
		const meta = await getMetadata(provider!, token ?? undefined);
		console.log({ meta });
		tokens[tokenKey] = {
			symbol: meta.symbol,
			decimals: meta.decimals,
			contract_type: meta.contract_type,
			available_balance: tokens[tokenKey]?.available_balance ?? '0',
		};
		console.log({ tokens });
		console.log('🛠 Migrated token metadata:', tokenKey, meta.symbol);
	}

	const current = BigInt(tokens[tokenKey]?.available_balance ?? '0');
	const newBalance = current + delta;

	if (newBalance < 0n) {
		throw new Error(`Negative balance detected for ${address}`);
	}

	tokens[tokenKey].available_balance = newBalance.toString();
	console.log({ tokens });

	const { error: updateError } = await supabase
		.from('ascend-accounts')
		.update({ tokens })
		.eq('address', address);

	if (updateError) throw updateError;

	console.log(
		`💰 ${type} ${tokenKey}:`,
		address,
		current.toString(),
		'→',
		newBalance.toString(),
	);
}


