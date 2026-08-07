/**
 * Timeline 条目排序（纯函数，不依赖 Obsidian 运行时）。
 *
 * 排序依据（sortBy）：
 * - created  → 文件创建时间（file.stat.ctime）
 * - modified → 文件修改时间（file.stat.mtime）
 * - start    → 条目开始时间（item.start）
 * - end      → 条目结束时间（item.end）
 *
 * 排序方向（sortOrder）：asc 正序、desc 倒序。
 * 同值时以文件路径兜底，保证结果稳定且确定（不依赖引擎默认排序）。
 */
import type { SortBy, SortOrder } from '../config/types';
import type { TimelineItem } from './types';

/** 解析单个条目的排序时间值（毫秒）。 */
function sortValue(item: TimelineItem, by: SortBy): number {
	switch (by) {
		case 'created':
			return item.file.stat.ctime;
		case 'modified':
			return item.file.stat.mtime;
		case 'start':
			return item.start?.getTime() ?? 0;
		case 'end':
			return item.end?.getTime() ?? 0;
	}
}

/**
 * 按配置对条目排序，返回新数组（不修改原数组）。
 * @param items 待排序条目（通常传入 status 为 valid 的条目）。
 * @param by 排序依据。
 * @param order 排序方向。
 */
export function sortTimelineItems(
	items: TimelineItem[],
	by: SortBy,
	order: SortOrder,
): TimelineItem[] {
	const factor = order === 'asc' ? 1 : -1;
	return [...items].sort((a, b) => {
		const diff = (sortValue(a, by) - sortValue(b, by)) * factor;
		if (diff !== 0) return diff;
		return a.file.path.localeCompare(b.file.path);
	});
}
