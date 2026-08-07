/**
 * 视图配置文件创建（Ribbon 按钮 / 目录右键菜单共用）。
 *
 * 职责：
 * - 读取文件 frontmatter 并解析（YAML 损坏时返回错误而非抛异常）；
 * - 生成不冲突的 vault 内文件路径（vault.getAvailablePath 无类型定义，自实现）；
 * - 新建视图配置文件并立即打开 Timeline 视图。
 */
import { Notice, type Plugin, type TFile } from 'obsidian';
import { t } from '../i18n';
import { buildConfigTemplate } from '../config/template';
import { extractFrontmatterText, parseFrontmatterText } from '../data/frontmatter';
import { openTimelineView } from '../views/open';

/** 新建配置文件的默认文件名（随语言翻译；冲突时由 getUniqueFilePath 自动追加序号）。 */
export const getConfigFileName = (): string => t('config.fileName');

export interface FrontmatterResult {
	status: 'ok' | 'malformed' | 'none';
	/** 解析出的 frontmatter 对象（status 为 'ok' 时有值）。 */
	frontmatter?: unknown;
	/** YAML 解析失败原因（status 为 'malformed' 时有值）。 */
	error?: string;
}

/** 读取文件 frontmatter 文本并解析；YAML 损坏时捕获错误而非抛给调用方。 */
export async function readFrontmatter(plugin: Plugin, file: TFile): Promise<FrontmatterResult> {
	const content = await plugin.app.vault.cachedRead(file);
	const fmText = extractFrontmatterText(content);
	if (fmText === null) {
		return { status: 'none' };
	}
	const result = parseFrontmatterText(fmText);
	if (!result.ok) {
		return { status: 'malformed', error: result.error ?? '未知错误' };
	}
	return { status: 'ok', frontmatter: result.data ?? undefined };
}

/** 生成不冲突的 vault 内文件路径：已存在时追加 " 1"、" 2"… 序号。 */
export function getUniqueFilePath(plugin: Plugin, basePath: string, extension: string): string {
	for (let i = 0; ; i++) {
		const candidate = i === 0 ? `${basePath}.${extension}` : `${basePath} ${i}.${extension}`;
		if (plugin.app.vault.getAbstractFileByPath(candidate) === null) {
			return candidate;
		}
	}
}

/** 在指定目录（相对 vault 根，空字符串为根）新建配置文件并直接打开 Timeline 视图。 */
export async function createConfigFile(plugin: Plugin, folder: string): Promise<TFile> {
	const basePath = folder ? `${folder}/${getConfigFileName()}` : getConfigFileName();
	const path = getUniqueFilePath(plugin, basePath, 'md');
	const file = await plugin.app.vault.create(path, buildConfigTemplate(folder));
	new Notice(t('notice.configCreated', { path: file.path }));
	await openTimelineView(plugin, file);
	return file;
}
