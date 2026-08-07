/**
 * frontmatter 读取与解析（IO 层）。
 *
 * 本模块依赖 Obsidian 运行时（parseYaml / Vault），仅在 Obsidian 环境加载；
 * 数据层的纯函数测试不引用本模块（build.ts 通过注入的 reader 隔离 IO）。
 *
 * 时区一致性说明：
 * Obsidian 的 parseYaml 基于 js-yaml，会把无时区的 ISO 日期（如 `2026-08-06`、
 * `2026-08-06T20:30:00`）解析为 **UTC** 语义的 Date；而用户通常期望这些写法按
 * 本地时间理解。normalizeYamlDates 将这些 Date 转回「无时区本地时间字符串」
 * （UTC 墙钟 -> 本地解释），使 parseDateValue 对主流写法全部按本地时间解析，
 * 行为保持一致。
 */
import { parseYaml, type TFile, type Vault } from 'obsidian';
import type { FrontmatterRead, FrontmatterReader } from './types';

/**
 * 提取 Markdown 文件开头的 frontmatter 块文本（纯函数）。
 * 仅当文件以 `---` 开头且有闭合的 `---` 时返回块内文本；否则返回 null。
 * （与 commands/ribbon.ts 内实现一致，步骤 6 清理时统一复用。）
 */
export function extractFrontmatterText(content: string): string | null {
	const lines = content.split('\n');
	if ((lines[0] ?? '').trim() !== '---') {
		return null;
	}
	for (let i = 1; i < lines.length; i++) {
		if ((lines[i] ?? '').trim() === '---') {
			return lines.slice(1, i).join('\n');
		}
	}
	// 没有闭合标记：不视为 frontmatter（与 Obsidian 行为一致）。
	return null;
}

/** 将 Date 格式化为无时区本地时间字符串（UTC 墙钟），供 parseDateValue 按本地解析。 */
function dateToLocalString(date: Date): string {
	const pad = (n: number): string => String(n).padStart(2, '0');
	return (
		`${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
		`T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
	);
}

/** 递归将解析结果中的 Date 值规范化为本地时间字符串。 */
function normalizeYamlDates(value: unknown): unknown {
	if (value instanceof Date) {
		return dateToLocalString(value);
	}
	if (Array.isArray(value)) {
		return value.map(normalizeYamlDates);
	}
	if (value !== null && typeof value === 'object') {
		const result: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
			result[key] = normalizeYamlDates(item);
		}
		return result;
	}
	return value;
}

/**
 * 解析 frontmatter 块文本（纯函数，不抛异常）。
 * - YAML 损坏 → { ok: false, error }；
 * - 空 frontmatter / 非对象 → { ok: true, data: null }；
 * - 成功 → { ok: true, data }（日期值已规范化为本地时间字符串）。
 */
export function parseFrontmatterText(text: string): FrontmatterRead {
	try {
		const parsed: unknown = parseYaml(text);
		if (parsed === null || parsed === undefined) {
			return { ok: true, data: null };
		}
		if (typeof parsed !== 'object' || Array.isArray(parsed)) {
			return { ok: false, error: 'frontmatter 不是 YAML 对象' };
		}
		return { ok: true, data: normalizeYamlDates(parsed) as Record<string, unknown> };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
}

/**
 * 默认 frontmatter 读取器：通过 vault 读取文件内容并解析。
 * @param vault Obsidian Vault 实例。
 */
export function createVaultFrontmatterReader(vault: Vault): FrontmatterReader {
	return async (file: TFile): Promise<FrontmatterRead> => {
		const content = await vault.cachedRead(file);
		const text = extractFrontmatterText(content);
		if (text === null) {
			return { ok: true, data: null };
		}
		return parseFrontmatterText(text);
	};
}
