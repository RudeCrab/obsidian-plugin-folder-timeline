/**
 * 配置模块统一出口：类型、解析校验、模板生成。
 */
export {
	parseTimelineConfig,
	isConfigFrontmatter,
} from './parse';
export { buildConfigTemplate } from './template';
export {
	DEFAULT_RECURSIVE,
	DEFAULT_SHOW_FILE_NAME,
	DEFAULT_DISPLAY_MODE,
} from './types';
export type {
	TimelineConfig,
	DisplayMode,
	SortBy,
	SortOrder,
	ConfigError,
	ParseTimelineConfigResult,
} from './types';
