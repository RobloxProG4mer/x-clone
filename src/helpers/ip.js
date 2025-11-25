export function getSubnetPrefix(ip) {
	if (!ip) return null;
	if (ip.includes(":")) {
		// IPv6: assume /64 (first 4 groups)
		const parts = ip.split(":");
		return parts.slice(0, 4).join(":") + ":";
	} else {
		// IPv4: assume /24 (first 3 octets)
		const parts = ip.split(".");
		return parts.slice(0, 3).join(".") + ".";
	}
}
