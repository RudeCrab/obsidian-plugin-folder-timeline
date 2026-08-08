/**
 * Base 条目 → Timeline 条目转换器。
 *
 * 从 Obsidian Base 的 BasesEntry[] 生成 TimelineItem[]，复用现有的 parseDateValue，
 * 使 BasesView 与 ItemView 共享 GanttRenderer。
 *
 * 取值策略与 Power Bases 一致：直接从 metadataCache 读取文件 frontmatter，
 * 而非通过 BasesEntry.getValue()（后者返回值类型不稳定）。
 */
import type { App, BasesEntry, BasesPropertyId } from 'obsidian';
import { t } from '../i18n';
import { parseDateValue } from '../data/date';
import type { TimelineItem } from '../data';

/** 将 BasesPropertyId（如 `note.startDate`）转为纯 frontmatter key（`startDate`）。 */
function frontmatterKey(propId: BasesPropertyId): string {
	const dot = propId.indexOf('.');
	return dot >= 0 ? propId.slice(dot + 1) : propId;
}

/** 从 metadataCache 读取文件的 frontmatter 值。 */
function frontmatterValue(app: App, file: BasesEntry['file'], key: string): unknown {
	const cache = app.metadataCache.getFileCache(file);
	if (cache === null || cache.frontmatter === undefined) return undefined;
	return (cache.frontmatter as Record<string, unknown>)[key];
}

/** 将未知值转为可读字符串（用于错误提示）。 */
function safeString(value: unknown): string {
	if (value === null || value === undefined) return 'null';
	if (typeof value === 'string') return value;
	if (typeof value === 'number' || typeof value === 'boolean') return String(value);
	if (typeof value === 'object' && 'toString' in value) {
		const s = (value as { toString(): string }).toString();
		return s === '[object Object]' ? JSON.stringify(value) : s;
	}
	return JSON.stringify(value);
}

/**
 * 将 Base 查询结果转换为 TimelineItem[]。
 * @param app Obsidian App 实例（用于访问 metadataCache）。
 * @param entries Base 返回的条目列表。
 * @param startPropId 开始时间属性 ID（如 `note.start`）。
 * @param endPropId 结束时间属性 ID（如 `note.end`）。
 * @returns TimelineItem[]，转换失败以 skipped 条目表达。
 */
export function basesEntriesToTimelineItems(
	app: App,
	entries: BasesEntry[],
	startPropId: BasesPropertyId,
	endPropId: BasesPropertyId,
): TimelineItem[] {
	const startKey = frontmatterKey(startPropId);
	const endKey = frontmatterKey(endPropId);

	return entries.map((entry) => {
		const startValue = frontmatterValue(app, entry.file, startKey);
		if (startValue === undefined || startValue === null) {
			return {
				file: entry.file,
				title: entry.file.basename,
				status: 'skipped',
				reason: t('build.missingStartField', { field: startPropId }),
			};
		}

		const start = parseDateValue(startValue);
		if (start === null) {
			return {
				file: entry.file,
				title: entry.file.basename,
				status: 'skipped',
				reason: t('build.startNotDate', {
					field: startPropId,
					value: safeString(startValue),
				}),
			};
		}

		const endValue = frontmatterValue(app, entry.file, endKey);
		if (endValue === undefined || endValue === null) {
			// 单点事件：只有开始时间。
			return { file: entry.file, title: entry.file.basename, start, end: start, status: 'valid' };
		}

		const end = parseDateValue(endValue);
		if (end === null) {
			return {
				file: entry.file,
				title: entry.file.basename,
				status: 'skipped',
				reason: t('build.endNotDate', {
					field: endPropId,
					value: safeString(endValue),
				}),
			};
		}

		if (end < start) {
			return {
				file: entry.file,
				title: entry.file.basename,
				status: 'skipped',
				reason: t('build.startAfterEnd'),
			};
		}

		return { file: entry.file, title: entry.file.basename, start, end, status: 'valid' };
	});
}
