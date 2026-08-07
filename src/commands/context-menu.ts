/**
 * 入口二：文件管理器目录右键菜单。
 *
 * 在 FileExplorer 的目录上右键 → 菜单项「在此目录创建 Timeline 视图」：
 * 1. 该目录下已存在视图配置文件（frontmatter 含 `timeline: true`）→ 直接打开渲染；
 * 2. 否则新建配置文件（`folder` 预填该目录相对 vault 根路径）并打开渲染。
 *
 * 通过 workspace 'file-menu' 事件注册（registerEvent 自动清理，卸载无残留）。
 */
import { Notice, TFolder, TFile, type Menu, type Plugin } from 'obsidian';
import { t } from '../i18n';
import { isConfigFrontmatter } from '../config/parse';
import { openTimelineView } from '../views/open';
import { createConfigFile, readFrontmatter } from './create-config';

/** 在 FileExplorer 目录右键菜单注册「在此目录创建 Timeline 视图」项。 */
export function registerFolderContextMenu(plugin: Plugin): void {
	plugin.registerEvent(
		plugin.app.workspace.on('file-menu', (menu: Menu, file) => {
			if (!(file instanceof TFolder)) {
				return;
			}
			menu.addItem((item) => {
				item.setTitle(t('menu.createInFolder'))
					.setIcon('timeline')
					.onClick(() => {
						void openOrCreateForFolder(plugin, file.path);
					});
			});
		}),
	);
}

/** 打开该目录下已有的配置文件；没有则新建（folder 预填目录路径）并打开。 */
async function openOrCreateForFolder(plugin: Plugin, folderPath: string): Promise<void> {
	const existing = await findConfigFileInFolder(plugin, folderPath);
	if (existing !== null) {
		await openTimelineView(plugin, existing);
		return;
	}
	await createConfigFile(plugin, folderPath);
}

/**
 * 在目录（非递归）中查找第一个视图配置文件。
 * frontmatter 损坏 / 无 frontmatter / 非配置文件均跳过；找不到返回 null。
 */
async function findConfigFileInFolder(plugin: Plugin, folderPath: string): Promise<TFile | null> {
	const folder =
		folderPath === '' ? plugin.app.vault.getRoot() : plugin.app.vault.getFolderByPath(folderPath);
	if (folder === null) {
		new Notice(t('notice.folderNotFound', { folder: folderPath === '' ? t('view.vaultRootParens') : folderPath }));
		return null;
	}

	const candidates = folder.children.filter(
		(child): child is TFile => child instanceof TFile && child.extension === 'md',
	);
	const results = await Promise.all(candidates.map((child) => readFrontmatter(plugin, child)));
	const index = results.findIndex(
		(result) => result.status === 'ok' && isConfigFrontmatter(result.frontmatter),
	);
	return index === -1 ? null : (candidates[index] ?? null);
}
