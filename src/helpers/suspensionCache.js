// Helper for a shared suspension cache so admin and API can invalidate entries
export const suspensionCache = new Map();

export function getSuspensionCache(userId) {
	return suspensionCache.get(userId);
}

export function setSuspensionCache(userId, value) {
	suspensionCache.set(userId, value);
}

export function clearSuspensionCache(userId) {
	suspensionCache.delete(userId);
}
