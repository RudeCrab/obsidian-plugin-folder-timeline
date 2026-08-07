/**
 * 入口一：Ribbon 图标按钮。
 *
 * 点击逻辑（主提示词第三节第 3 条 + 增强）：
 * 1. 当前活动文件是视图配置文件（frontmatter 含 `timeline: true`）→ 直接打开 Timeline 视图渲染；
 * 2. 当前活动文件不是视图配置文件 → 在其所在目录新建配置文件，并**立即打开 Timeline 视图**
 *    （无需第二次点击；视图内可切换查看配置文件原文）；
 * 3. 无活动文件 → 在 vault 根目录新建配置文件并立即打开视图。
 *
 * 文件 frontmatter 损坏（YAML 解析失败）时给出明确错误提示，不崩溃、不覆盖。
 * 创建 / 读取逻辑复用 src/commands/create-config.ts，与右键菜单入口行为一致。
 */
import { Notice, type Plugin } from 'obsidian';
import { t } from '../i18n';
import { isConfigFrontmatter } from '../config/parse';
import { openTimelineView } from '../views/open';
import { createConfigFile, readFrontmatter } from './create-config';

/** 注册 Ribbon 按钮；由插件 onload 调用，经 register 机制自动清理。 */
export function registerRibbonButton(plugin: Plugin): void {
	plugin.addRibbonIcon('timeline', t('ribbon.tooltip'), async () => {
		const activeFile = plugin.app.workspace.getActiveFile();

		if (activeFile === null) {
			await createConfigFile(plugin, '');
			return;
		}

		const result = await readFrontmatter(plugin, activeFile);
		if (result.status === 'malformed') {
			new Notice(
				t('notice.frontmatterParseFailed', {
					name: activeFile.name,
					error: result.error ?? t('notice.unknownError'),
				}),
				8000,
			);
			return;
		}

		if (isConfigFrontmatter(result.frontmatter)) {
			// 已识别为视图配置文件 → 打开 Timeline 视图渲染。
			await openTimelineView(plugin, activeFile);
			return;
		}

		// 普通文件：在其所在目录创建配置文件（无父目录则视为 vault 根）。
		const folder = activeFile.parent?.path ?? '';
		await createConfigFile(plugin, folder);
	});
}
