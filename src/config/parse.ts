/**
 * 视图配置文件 frontmatter 的解析与校验（纯函数，不依赖 Obsidian 运行时）。
 */
import { t } from '../i18n';
import {
	DEFAULT_DISPLAY_MODE,
	DEFAULT_RECURSIVE,
	DEFAULT_SHOW_FILE_NAME,
	DEFAULT_SORT_BY,
	DEFAULT_SORT_ORDER,
	type ConfigError,
	type DisplayMode,
	type ParseTimelineConfigResult,
	type SortBy,
	type SortOrder,
} from './types';

const DISPLAY_MODES: readonly string[] = ['year', 'month', 'day'];
const SORT_BY_VALUES: readonly string[] = ['created', 'modified', 'start', 'end'];
const SORT_ORDER_VALUES: readonly string[] = ['asc', 'desc'];

/** 校验 frontmatter 是否为有效的视图配置对象；失败时返回错误列表，不抛异常。 */
export function parseTimelineConfig(raw: unknown): ParseTimelineConfigResult {
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		return {
			ok: false,
			errors: [
				{
					field: 'frontmatter',
					message: t('config.errNotObject'),
				},
			],
		};
	}

	const fm = raw as Record<string, unknown>;
	const errors: ConfigError[] = [];

		if (fm.timeline !== true) {
		errors.push({
			field: 'timeline',
			message: t('config.errTimelineTrue'),
		});
	}

	const requireString = (field: 'folder' | 'startField' | 'endField'): void => {
		const value = fm[field];
		if (value === undefined) {
			errors.push({ field, message: t('config.errMissingField', { field }) });
		} else if (typeof value !== 'string') {
			errors.push({ field, message: t('config.errMustBeString', { field, type: typeof value }) });
		}
	};
	requireString('folder');
	requireString('startField');
	requireString('endField');

	if (fm.recursive !== undefined && typeof fm.recursive !== 'boolean') {
		errors.push({
			field: 'recursive',
			message: t('config.errRecursiveBool', { type: typeof fm.recursive }),
		});
	}

	if (fm.showFileName !== undefined && typeof fm.showFileName !== 'boolean') {
		errors.push({
			field: 'showFileName',
			message: t('config.errShowFileNameBool', { type: typeof fm.showFileName }),
		});
	}

	if (fm.displayMode !== undefined) {
		const displayModeValue = fm.displayMode;
		const displayModeText =
			typeof displayModeValue === 'string'
				? JSON.stringify(displayModeValue)
				: `（类型：${typeof displayModeValue}）`;
		const isValid =
			typeof displayModeValue === 'string' && DISPLAY_MODES.includes(displayModeValue);
		if (!isValid) {
			errors.push({
				field: 'displayMode',
				message: t('config.errDisplayMode', { value: displayModeText }),
			});
		}
	}

	if (fm.sortBy !== undefined) {
		const sortByValue = fm.sortBy;
		const sortByText =
			typeof sortByValue === 'string'
				? JSON.stringify(sortByValue)
				: `（类型：${typeof sortByValue}）`;
		const isValid = typeof sortByValue === 'string' && SORT_BY_VALUES.includes(sortByValue);
		if (!isValid) {
			errors.push({
				field: 'sortBy',
				message: t('config.errSortBy', { value: sortByText }),
			});
		}
	}

	if (fm.sortOrder !== undefined) {
		const sortOrderValue = fm.sortOrder;
		const sortOrderText =
			typeof sortOrderValue === 'string'
				? JSON.stringify(sortOrderValue)
				: `（类型：${typeof sortOrderValue}）`;
		const isValid =
			typeof sortOrderValue === 'string' && SORT_ORDER_VALUES.includes(sortOrderValue);
		if (!isValid) {
			errors.push({
				field: 'sortOrder',
				message: t('config.errSortOrder', { value: sortOrderText }),
			});
		}
	}

	if (errors.length > 0) {
		return { ok: false, errors };
	}

	return {
		ok: true,
		config: {
			timeline: true,
			folder: fm.folder as string,
			recursive: fm.recursive === undefined ? DEFAULT_RECURSIVE : (fm.recursive as boolean),
			startField: fm.startField as string,
			endField: fm.endField as string,
			showFileName:
				fm.showFileName === undefined ? DEFAULT_SHOW_FILE_NAME : (fm.showFileName as boolean),
			displayMode:
				fm.displayMode === undefined ? DEFAULT_DISPLAY_MODE : (fm.displayMode as DisplayMode),
			sortBy: fm.sortBy === undefined ? DEFAULT_SORT_BY : (fm.sortBy as SortBy),
			sortOrder: fm.sortOrder === undefined ? DEFAULT_SORT_ORDER : (fm.sortOrder as SortOrder),
		},
	};
}

/** frontmatter 中 `timeline === true` 即视为视图配置文件（纯函数判断）。 */
export function isConfigFrontmatter(raw: unknown): boolean {
	return (
		raw !== null &&
		typeof raw === 'object' &&
		!Array.isArray(raw) &&
		(raw as Record<string, unknown>).timeline === true
	);
}
