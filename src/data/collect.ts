/**
 * 目录收集（纯函数 + 最小依赖注入）。
 *
 * collectMarkdownFiles 通过 `VaultFileSource` 接口访问文件系统，而不是直接依赖
 * Obsidian 的 Vault 类 —— Obsidian 的 Vault 结构上满足该接口（getAbstractFileByPath /
 * getFiles），测试时也可注入 mock 对象。
 */
import type { TAbstractFile, TFile, TFolder } from 'obsidian';
import type { CollectMarkdownResult } from './types';

/**
 * collectMarkdownFiles 依赖的最小 vault 接口（鸭子类型）。
 * Obsidian 的 `Vault` 实例直接满足该结构。
 */
export interface VaultFileSource {
	getAbstractFileByPath(path: string): TAbstractFile | null;
	getFiles(): TFile[];
}

/** 判断是否为目录：TFolder 拥有 children 属性，TFile 没有（避免依赖 Obsidian 类做 instanceof）。 */
function isFolderLike(abstractFile: TAbstractFile): abstractFile is TFolder {
	return 'children' in abstractFile;
}

/**
 * 收集目录下的 Markdown 文件。
 * @param folderPath 相对 vault 根目录的路径；空字符串表示 vault 根目录。
 * @param vault 文件系统访问源（Obsidian Vault 或测试 mock）。
 * @param recursive 是否递归扫描子目录；false 时仅收集当前目录的直接子文件
 *                  （vault 根时仅收集不在任何子目录中的文件）。
 * @returns 目录不存在 / 路径不是目录时返回错误码（不抛异常）；目录为空时 files 为 []。
 */
export function collectMarkdownFiles(
	folderPath: string,
	vault: VaultFileSource,
	recursive = false,
): CollectMarkdownResult {
	const folder = folderPath.trim().replace(/\/+$/, '');
	const prefix = folder === '' ? '' : `${folder}/`;

	// 目录存在性检查（folder 为空字符串表示 vault 根，跳过检查）。
	if (folder !== '') {
		const abstractFile = vault.getAbstractFileByPath(folder);
		if (abstractFile === null) {
			return { ok: false, error: 'folder-not-found', files: [] };
		}
		if (!isFolderLike(abstractFile)) {
			return { ok: false, error: 'folder-not-directory', files: [] };
		}
	}

	// vault.getFiles() 只返回 Markdown 文件，天然忽略非 Markdown 文件。
	const files = vault.getFiles().filter((file) => {
		if (!file.path.startsWith(prefix)) {
			return false;
		}
		if (recursive) {
			return true;
		}
		// 非递归：文件必须直接位于目录下（路径中不含更深层的分隔符）。
		return file.path.indexOf('/', prefix.length) === -1;
	});
	return { ok: true, files };
}
