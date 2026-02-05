import { supabase } from '.';

type EventType = 'DEPOSIT' | 'WITHDRAW';

export async function applyAccountDelta(
	address: string,
	token: string | null,
	amount: bigint,
	type: EventType,
) {
	const tokenKey = token ?? 'ETH';
	const delta = type === 'DEPOSIT' ? amount : -amount;
	const { data, error } = await supabase
		.from('ascend-accounts')
		.select('tokens')
		.eq('address', address)
		.single();

	if (error) throw error;

	const tokens = data?.tokens ?? {};

	const current = BigInt(tokens[tokenKey]?.available_balance ?? '0');
	const newBalance = current + delta;

	if (newBalance < 0n) {
		throw new Error(`Negative balance detected for ${address}`);
	}

	tokens[tokenKey] = {
		available_balance: newBalance.toString(),
	};

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
