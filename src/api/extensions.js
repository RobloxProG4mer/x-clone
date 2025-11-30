import { existsSync, promises as fs, mkdirSync } from "node:fs";
import { join } from "node:path";
import { Elysia, file } from "elysia";
import db from "../db.js";

const extensionsDir = join(process.cwd(), "ext");
if (!existsSync(extensionsDir)) {
	mkdirSync(extensionsDir, { recursive: true });
}
const legacyExtensionsDir = join(process.cwd(), ".data", "extensions");
if (!existsSync(legacyExtensionsDir)) {
	mkdirSync(legacyExtensionsDir, { recursive: true });
}

const parseJsonSafely = (value, fallback) => {
	if (!value) return fallback;
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
};

const safeDirNamePattern = /^[A-Za-z0-9._-]+$/;

const getInstallDirName = (record) => {
	const manifest = parseJsonSafely(record.manifest_json, {});
	const dirName = manifest?.install_dir;
	if (typeof dirName === "string" && safeDirNamePattern.test(dirName.trim())) {
		return dirName.trim();
	}
	return null;
};

const mapExtensionRecord = (record) => {
	const manifest = parseJsonSafely(record.manifest_json, {}) || {};
	const schemaCandidate =
		manifest.settings ??
		manifest.settings_schema ??
		manifest.preferences ??
		manifest.schema ??
		manifest["settings-schema"];
	return {
		id: record.id,
		name: record.name,
		version: record.version,
		author: record.author,
		summary: record.summary,
		description: record.description,
		website: record.website,
		changelogUrl: record.changelog_url,
		rootFile: record.root_file,
		entryType: record.entry_type,
		styles: parseJsonSafely(record.styles, []),
		capabilities: parseJsonSafely(record.capabilities, []),
		targets: parseJsonSafely(record.targets, []),
		bundleHash: record.bundle_hash,
		fileEndpoint: `/api/extensions/${encodeURIComponent(record.id)}/file`,
		installDir: getInstallDirName(record),
		settingsSchema: parseSettingsSchema(schemaCandidate),
		managed: true,
		enabled: !!record.enabled,
	};
};

const extensionSettingsSelect = db.prepare(
	"SELECT settings FROM extension_settings WHERE extension_id = ?",
);

const sanitizeShortText = (value, max = 512) => {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	return trimmed.slice(0, max);
};

const collectStringList = (value, limit = 12, maxLength = 64) => {
	if (!Array.isArray(value)) return [];
	const store = new Set();
	const list = [];
	for (const entry of value) {
		if (typeof entry !== "string") continue;
		const trimmed = entry.trim();
		if (!trimmed) continue;
		const clipped = trimmed.slice(0, maxLength);
		if (store.has(clipped)) continue;
		store.add(clipped);
		list.push(clipped);
		if (list.length >= limit) break;
	}
	return list;
};

const collectStylePaths = (value) => {
	if (!Array.isArray(value)) return [];
	const seen = new Set();
	const list = [];
	for (const entry of value) {
		const normalized = normalizeRelativePath(entry);
		if (!normalized) continue;
		if (!normalized.startsWith("src/") || !normalized.endsWith(".css")) {
			continue;
		}
		if (seen.has(normalized)) continue;
		seen.add(normalized);
		list.push(normalized);
	}
	return list;
};

const allowedSettingTypes = new Set([
	"text",
	"textarea",
	"number",
	"select",
	"toggle",
]);

const sanitizeSettingKey = (value) => {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	const normalized = trimmed.replace(/[^A-Za-z0-9._-]/g, "_");
	return normalized.slice(0, 64);
};

const sanitizeSettingString = (value, max = 256) => {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!trimmed) return null;
	return trimmed.slice(0, max);
};

const parseSettingsOptions = (value) => {
	if (!Array.isArray(value)) return [];
	const options = [];
	const seen = new Set();
	for (const entry of value) {
		if (typeof entry !== "object" || !entry) continue;
		const optionValue =
			sanitizeSettingString(
				entry.value ?? entry.id ?? entry.key ?? entry.name,
				120,
			) ?? null;
		if (!optionValue || seen.has(optionValue)) continue;
		const label =
			sanitizeSettingString(entry.label ?? entry.name ?? entry.title, 120) ||
			optionValue;
		options.push({ value: optionValue, label });
		seen.add(optionValue);
		if (options.length >= 24) break;
	}
	return options;
};

const parseSettingsSchema = (value) => {
	if (!Array.isArray(value)) return [];
	const schema = [];
	const keys = new Set();
	for (const entry of value) {
		if (typeof entry !== "object" || !entry) continue;
		const key = sanitizeSettingKey(entry.key ?? entry.name ?? entry.id);
		if (!key || keys.has(key)) continue;
		let type =
			typeof entry.type === "string" ? entry.type.trim().toLowerCase() : "text";
		if (!allowedSettingTypes.has(type)) {
			type = "text";
		}
		const label =
			sanitizeShortText(entry.label ?? entry.name ?? key, 80) || key;
		const description = sanitizeShortText(
			entry.description ?? entry.help ?? entry.subtitle,
			240,
		);
		const placeholder = sanitizeShortText(entry.placeholder, 160);
		const field = { key, type, label };
		if (description) field.description = description;
		if (placeholder && (type === "text" || type === "textarea")) {
			field.placeholder = placeholder;
		}
		if (type === "number") {
			const min = Number(entry.min ?? entry.minimum);
			const max = Number(entry.max ?? entry.maximum);
			const step = Number(entry.step ?? entry.increment ?? 1);
			if (Number.isFinite(min)) field.min = min;
			if (Number.isFinite(max)) field.max = max;
			if (Number.isFinite(step) && step > 0) field.step = step;
			const defaultValue = Number(
				entry.default ?? entry.value ?? entry.initial,
			);
			if (Number.isFinite(defaultValue)) field.default = defaultValue;
		} else if (type === "select") {
			const options = parseSettingsOptions(
				entry.options ?? entry.choices ?? entry.values,
			);
			if (!options.length) continue;
			field.options = options;
			const defaultValue = sanitizeSettingString(
				entry.default ?? entry.value ?? entry.initial ?? options[0]?.value,
				120,
			);
			if (defaultValue) field.default = defaultValue;
		} else if (type === "toggle") {
			const rawDefault = entry.default ?? entry.value ?? entry.initial;
			const boolDefault =
				rawDefault === true ||
				rawDefault === 1 ||
				rawDefault === "1" ||
				rawDefault === "true";
			field.default = boolDefault;
		} else if (type === "textarea") {
			const maxLength = Number(entry.maxLength ?? entry.max_length);
			if (Number.isFinite(maxLength) && maxLength > 0) {
				field.maxLength = Math.min(Math.max(32, maxLength), 2000);
			}
			const defaultValue = sanitizeSettingString(
				entry.default ?? entry.value ?? entry.initial,
				field.maxLength || 512,
			);
			if (defaultValue) field.default = defaultValue;
		} else {
			const maxLength = Number(entry.maxLength ?? entry.max_length);
			if (Number.isFinite(maxLength) && maxLength > 0) {
				field.maxLength = Math.min(Math.max(16, maxLength), 512);
			}
			const defaultValue = sanitizeSettingString(
				entry.default ?? entry.value ?? entry.initial,
				field.maxLength || 256,
			);
			if (defaultValue) field.default = defaultValue;
		}
		schema.push(field);
		keys.add(key);
		if (schema.length >= 24) break;
	}
	return schema;
};

const parseManualManifest = (manifest, dirName) => {
	if (typeof manifest !== "object" || !manifest) return null;
	const rootCandidate =
		manifest.root_file ??
		manifest.rootFile ??
		manifest["root-file"] ??
		manifest.main ??
		"src/index.js";
	const normalizedRoot = normalizeRelativePath(rootCandidate);
	if (
		!normalizedRoot ||
		!normalizedRoot.startsWith("src/") ||
		!normalizedRoot.endsWith(".js")
	) {
		return null;
	}
	// Use the directory name as the canonical identifier for manual installs
	// to ensure the manual extension's id stays stable across import/de-import.
	const safeId = dirName;
	const name = sanitizeShortText(manifest.name, 80) || safeId;
	const version = sanitizeShortText(manifest.version, 32) || "0.0.0";
	const author = sanitizeShortText(manifest.author, 120);
	const summary = sanitizeShortText(manifest.summary, 280);
	const description = sanitizeShortText(manifest.description, 2000);
	const website = sanitizeShortText(manifest.website, 2048);
	const changelogUrl = sanitizeShortText(
		manifest.changelog_url ?? manifest.changelogUrl,
		2048,
	);
	const entryTypeRaw =
		manifest.entry_type ?? manifest.entryType ?? manifest.mode ?? "module";
	const entryType =
		typeof entryTypeRaw === "string" && entryTypeRaw.toLowerCase() === "script"
			? "script"
			: "module";
	const schemaCandidate =
		manifest.settings ??
		manifest.settings_schema ??
		manifest.preferences ??
		manifest.schema ??
		manifest["settings-schema"];
	return {
		// expose the id as the install directory name so the frontend and
		// admin APIs consistently reference manual entries by directory
		// rather than an embedded manifest id.
		id: safeId,
		name,
		version,
		author,
		summary,
		description,
		website,
		changelogUrl,
		rootFile: normalizedRoot,
		entryType,
		styles: collectStylePaths(
			manifest.styles ?? manifest.style_files ?? manifest["style-files"],
		),
		capabilities: collectStringList(manifest.capabilities ?? manifest.scopes),
		targets: collectStringList(manifest.targets ?? manifest["applies-to"]),
		settingsSchema: parseSettingsSchema(schemaCandidate),
	};
};

const discoverManualExtensions = async (managedInstallDirs = new Set()) => {
	try {
		const dirents = await fs.readdir(extensionsDir, { withFileTypes: true });
		const manuals = [];
		for (const dirent of dirents) {
			if (!dirent.isDirectory()) continue;
			const dirName = dirent.name;
			if (managedInstallDirs.has(dirName)) continue;
			const manifestPath = join(extensionsDir, dirName, "ext.json");
			const manifestFile = Bun.file(manifestPath);
			if (!(await manifestFile.exists())) continue;
			let manifestText;
			let parsed;
			try {
				manifestText = await manifestFile.text();
				parsed = JSON.parse(manifestText);
			} catch {
				continue;
			}
			let descriptor = parseManualManifest(parsed, dirName);
			if (!descriptor) {
				// tolerant fallback: attempt to build a minimal descriptor
				const rootCandidate =
					parsed?.root_file ??
					parsed?.rootFile ??
					parsed?.main ??
					parsed?.entry ??
					"src/index.js";
				if (
					typeof rootCandidate === "string" &&
					rootCandidate.startsWith("src/") &&
					rootCandidate.endsWith(".js")
				) {
					descriptor = {
						id: dirName,
						name: parsed?.name || dirName,
						version: parsed?.version || "0.0.0",
						author: parsed?.author || null,
						summary: parsed?.summary || null,
						description: parsed?.description || null,
						website: parsed?.website || null,
						changelogUrl: parsed?.changelog_url || parsed?.changelogUrl || null,
						rootFile: rootCandidate,
						entryType: parsed?.entry_type || parsed?.entryType || "module",
						styles: Array.isArray(parsed?.styles) ? parsed.styles : [],
						capabilities: Array.isArray(parsed?.capabilities)
							? parsed.capabilities
							: [],
						targets: Array.isArray(parsed?.targets) ? parsed.targets : [],
						settingsSchema: Array.isArray(parsed?.settings)
							? parsed.settings
							: [],
					};
				}
			}
			if (!descriptor) continue;
			const hasher = new Bun.CryptoHasher("sha256");
			hasher.update(manifestText);
			try {
				const stats = await fs.stat(join(extensionsDir, dirName));
				hasher.update(String(stats.mtimeMs || ""));
			} catch {}
			const fileEndpoint = `/api/extensions/${encodeURIComponent(dirName)}/file`;
			manuals.push({
				...descriptor,
				bundleHash: hasher.digest("hex"),
				fileEndpoint,
				installDir: dirName,
				managed: false,
				enabled: false,
			});
		}
		return manuals;
	} catch {
		return [];
	}
};

const resolveExtensionTarget = async (
	rawId,
	{ requireEnabled = true } = {},
) => {
	const record = extensionByIdQuery.get(rawId);
	if (record) {
		if (requireEnabled && !record.enabled) {
			return null;
		}
		return {
			type: "managed",
			settingsKey: record.id,
			installDir: getInstallDirName(record),
		};
	}
	const dirName = sanitizeDirSegment(rawId);
	if (!dirName) return null;
	const manifestFile = Bun.file(join(extensionsDir, dirName, "ext.json"));
	if (!(await manifestFile.exists())) return null;
	return {
		type: "manual",
		settingsKey: dirName,
	};
};

const normalizeRelativePath = (value) => {
	if (typeof value !== "string") return null;
	const trimmed = value.replace(/\\/g, "/").replace(/^\.\/+/, "");
	const parts = trimmed
		.split("/")
		.filter((segment) => segment && segment !== ".");
	if (!parts.length) return null;
	if (parts.some((segment) => segment === "..")) return null;
	const normalized = parts.join("/");
	if (!normalized.startsWith("src/") && !normalized.startsWith("assets/")) {
		return null;
	}
	return normalized;
};

const resolveManagedRoot = (record) => {
	const dirName = getInstallDirName(record);
	if (dirName) {
		return join(extensionsDir, dirName);
	}
	return join(legacyExtensionsDir, record.id);
};

const sanitizeDirSegment = (value) => {
	if (typeof value !== "string") return null;
	const trimmed = value.trim();
	if (!safeDirNamePattern.test(trimmed)) return null;
	return trimmed;
};

const enabledExtensionsQuery = db.prepare(
	"SELECT * FROM extensions WHERE enabled = 1 ORDER BY created_at ASC",
);

const extensionByIdQuery = db.prepare("SELECT * FROM extensions WHERE id = ?");

export async function mountServerExtensions(app) {
	const enabledRows = enabledExtensionsQuery.all();
	const managed = enabledRows.map(mapExtensionRecord);
	const managedDirs = new Set(managed.map((r) => r.installDir).filter(Boolean));
	const manual = await discoverManualExtensions(managedDirs);
	const candidates = [...managed, ...manual];

	for (const ext of candidates) {
		try {
			const root = ext.installDir
				? join(process.cwd(), "ext", ext.installDir)
				: null;
			if (!root) continue;
			const serverApiPath = join(root, "server", "api.js");
			const fileExists = await Bun.file(serverApiPath).exists();
			if (!fileExists) continue;
			const module = await import(`file://${serverApiPath}`);
			if (module?.default && typeof app.use === "function") {
				try {
					app.use(module.default);
					console.log(`Mounted server extension API: ${ext.id}`);
				} catch (err) {
					console.error(`Failed to mount server extension ${ext.id}:`, err);
				}
			}
		} catch (err) {
			console.error("Error while processing extension server API:", err);
		}
	}
}

export default new Elysia({ prefix: "/extensions", tags: ["Extensions"] })
	.get("/", async () => {
		const enabledRows = enabledExtensionsQuery.all();
		const managed = enabledRows.map(mapExtensionRecord);
		const managedDirs = new Set(
			managed.map((record) => record.installDir).filter(Boolean),
		);
		const manual = await discoverManualExtensions(managedDirs);
		return { extensions: [...managed, ...manual] };
	})
	.get("/:id/settings", async ({ params, set }) => {
		const descriptor = await resolveExtensionTarget(params.id, {
			requireEnabled: false,
		});
		if (!descriptor) {
			set.status = 404;
			return { error: "Extension not found" };
		}
		const row = extensionSettingsSelect.get(descriptor.settingsKey);
		let settings = {};
		if (row?.settings) {
			try {
				settings = JSON.parse(row.settings) || {};
			} catch {
				settings = {};
			}
		}
		return { settings };
	})
	.get("/:id/file", async ({ params, query, set }) => {
		const relativePath = normalizeRelativePath(query.path);
		if (!relativePath) {
			set.status = 400;
			return { error: "Invalid file path" };
		}

		let rootDir;
		let cacheSeconds = 60;
		const managedExtension = extensionByIdQuery.get(params.id);
		if (managedExtension) {
			if (!managedExtension.enabled) {
				set.status = 404;
				return { error: "Extension not found" };
			}
			rootDir = resolveManagedRoot(managedExtension);
		} else {
			const dirName = sanitizeDirSegment(params.id);
			if (!dirName) {
				set.status = 404;
				return { error: "Extension not found" };
			}
			rootDir = join(extensionsDir, dirName);
			const manifestExists = await Bun.file(join(rootDir, "ext.json")).exists();
			if (!manifestExists) {
				set.status = 404;
				return { error: "Extension not found" };
			}
			cacheSeconds = 15;
		}

		const absolutePath = join(rootDir, ...relativePath.split("/"));

		if (!absolutePath.startsWith(rootDir)) {
			set.status = 400;
			return { error: "Invalid file path" };
		}

		if (!(await Bun.file(absolutePath).exists())) {
			set.status = 404;
			return { error: "File not found" };
		}

		set.headers = {
			"Cache-Control": `public, max-age=${cacheSeconds}`,
		};

		return file(absolutePath);
	});
