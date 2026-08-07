/**
 * 数据层统一出口：目录收集 + 时间解析 + 条目构建 + frontmatter 读取。
 */
export { collectMarkdownFiles, type VaultFileSource } from './collect';
export { parseDateValue } from './date';
export { buildTimelineItems } from './build';
export { sortTimelineItems } from './sort';
export {
	extractFrontmatterText,
	parseFrontmatterText,
	createVaultFrontmatterReader,
} from './frontmatter';
export type {
	TimelineItem,
	CollectErrorCode,
	CollectMarkdownResult,
	FrontmatterRead,
	FrontmatterReader,
} from './types';
