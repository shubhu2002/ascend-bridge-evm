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