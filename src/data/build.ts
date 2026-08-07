/**
 * Timeline 条目构建（纯函数 + reader 注入）。
 *
 * buildTimelineItems 不直接访问 vault：frontmatter 由调用方注入的 `FrontmatterReader`
 * 提供，因此核心逻辑可在 Node 中独立测试；视图层（步骤 3）传入
 * createVaultFrontmatterReader(vault) 即可接入真实 vault。
 */
import type { TFile } from 'obsidian';
import { t } from '../i18n';
import type { TimelineConfig } from '../config';
import { parseDateValue } from './date';
import type { FrontmatterReader, TimelineItem } from './types';

/** 将值描述为可读文本用于错误提示（JSON 序列化失败或超长时降级截断）。 */
function describeValue(value: unknown): string {
	let text: string;
	try {
		text = JSON.stringify(value);
	} catch {
		text = String(value);
	}
	if (text === undefined) {
		text = String(value);
	}
	return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}

/** 构造 skipped 条目。 */
function skipped(file: TFile, reason: string): TimelineItem {
	return { file, title: file.basename, status: 'skipped', reason };
}

/**
 * 构建单个文件的条目。
 * 边界策略（与主提示词第六节 4/5/6 条一致）：
 * - frontmatter 损坏 / 缺失 → skipped；
 * - startField 缺失、为 null 或解析失败 → skipped；
 * - endField 缺失、为 null 或空字符串 → 单点事件（end = start）；
 * - endField 存在但解析失败 → skipped；
 * - 开始时间晚于结束时间 → skipped；
 * - start === end → 有效（渲染为零宽单点）。
 */
async function buildItem(
	file: TFile,
	cfg: TimelineConfig,
	reader: FrontmatterReader,
): Promise<TimelineItem> {
	const read = await reader(file);
	if (!read.ok) {
		return skipped(file, t('build.frontmatterParseFailed', { error: read.error ?? t('notice.unknownError') }));
	}
	const data = read.data;
	if (data === null || data === undefined) {
		return skipped(file, t('build.noFrontmatter'));
	}

	const startValue = data[cfg.startField];
	if (startValue === undefined || startValue === null) {
		return skipped(file, t('build.missingStartField', { field: cfg.startField }));
	}
	const start = parseDateValue(startValue);
	if (start === null) {
		return skipped(
			file,
			t('build.startNotDate', { field: cfg.startField, value: describeValue(startValue) }),
		);
	}

	const endValue = data[cfg.endField];
	const isMissingEnd =
		endValue === undefined ||
		endValue === null ||
		(typeof endValue === 'string' && endValue.trim() === '');
	if (isMissingEnd) {
		// 单点事件策略：只有开始时间时 end = start，由视图渲染为无宽度标记点。
		return { file, title: file.basename, start, end: start, status: 'valid' };
	}

	const end = parseDateValue(endValue);
	if (end === null) {
		return skipped(
			file,
			t('build.endNotDate', { field: cfg.endField, value: describeValue(endValue) }),
		);
	}
	if (end < start) {
		return skipped(file, t('build.startAfterEnd'));
	}
	return { file, title: file.basename, start, end, status: 'valid' };
}

/**
 * 构建目录内全部文件的 Timeline 条目。
 * @param files 待处理的 Markdown 文件列表。
 * @param cfg 视图配置（startField / endField 决定读取哪些字段）。
 * @param reader frontmatter 读取器（由调用方注入，如 createVaultFrontmatterReader）。
 * @returns 与 files 一一对应的条目；不会抛异常（错误以 skipped 条目表达）。
 */
export async function buildTimelineItems(
	files: TFile[],
	cfg: TimelineConfig,
	reader: FrontmatterReader,
): Promise<TimelineItem[]> {
	const items: TimelineItem[] = [];
	for (const file of files) {
		items.push(await buildItem(file, cfg, reader));
	}
	return items;
}
