import { supabase } from "@/supabase";

const activeWithdraws = new Set<string>();

export function acquireWithdrawLock(address: string): boolean {
  address = address.toLowerCase();

  if (activeWithdraws.has(address)) return false;

  activeWithdraws.add(address);
  return true;
}

export function releaseWithdrawLock(address: string) {
  activeWithdraws.delete(address.toLowerCase());
}

export async function ensureAccountExists(address: string, createNew: boolean) {
	const { data } = await supabase
		.from('ascend-accounts')
		.select('address')
		.eq('address', address)
		.maybeSingle();

	if (createNew && !data) {
		const { error } = await supabase.from('ascend-accounts').insert({
			address,
			tokens: {},
			created_at: new Date().toISOString(),
		}).select().single();

		if (error && error.code !== '23505') {
			throw error;
		}

		console.log('🆕 Created account:', address);
	}

	return !!data;
}