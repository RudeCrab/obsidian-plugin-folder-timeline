/**
 * Timeline 视图配置模型。
 *
 * 配置完全由「视图配置文件」的 frontmatter 承载（模仿 Obsidian Base 插件），
 * 不含插件级设置项。
 */

/** 时间轴刻度粒度：按年 / 按月 / 按天。 */
export type DisplayMode = 'year' | 'month' | 'day';

/** 排序依据：文件创建时间 / 文件修改时间 / 开始字段 / 结束字段。 */
export type SortBy = 'created' | 'modified' | 'start' | 'end';

/** 排序方向：正序（升序）/ 倒序（降序）。 */
export type SortOrder = 'asc' | 'desc';

/**
 * 视图配置文件的有效配置。
 * - `timeline` 恒为 `true`，作为「该文件是否为视图配置文件」的标记；
 * - `folder` 相对 vault 根目录，空字符串表示 vault 根；
 * - `recursive` 是否递归扫描 `folder` 下的所有子目录（false 时仅收集当前目录的直接子文件）；
 * - `startField` / `endField` 为读取每个文件 frontmatter 的起止时间字段名；
 * - `showFileName` 控制时间条上是否显示文件名；
 * - `displayMode` 控制时间轴刻度粒度；
 * - `sortBy` 控制时间条（从上到下）的排序依据；
 * - `sortOrder` 控制排序方向（正序 / 倒序）。
 */
export interface TimelineConfig {
	timeline: true;
	folder: string;
	recursive: boolean;
	startField: string;
	endField: string;
	showFileName: boolean;
	displayMode: DisplayMode;
	sortBy: SortBy;
	sortOrder: SortOrder;
}

/** 结构化配置错误：定位到具体字段，便于视图内友好展示。 */
export interface ConfigError {
	/** 出错字段名；frontmatter 整体结构损坏时为 'frontmatter'。 */
	field: string;
	/** 人类可读的错误描述。 */
	message: string;
}

/** parseTimelineConfig 的返回值：成功携带配置，失败携带错误列表（禁止抛异常）。 */
export type ParseTimelineConfigResult =
	| { ok: true; config: TimelineConfig }
	| { ok: false; errors: ConfigError[] };

/** 可选字段的默认值（主提示词第四节）。 */
export const DEFAULT_RECURSIVE = false;
export const DEFAULT_SHOW_FILE_NAME = true;
export const DEFAULT_DISPLAY_MODE: DisplayMode = 'month';
export const DEFAULT_SORT_BY: SortBy = 'start';
export const DEFAULT_SORT_ORDER: SortOrder = 'asc';
