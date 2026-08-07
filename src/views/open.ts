/**
 * 打开 Timeline 视图的入口函数（Ribbon / 右键菜单共用）。
 */
import { type Plugin, type TFile } from 'obsidian';
import { VIEW_TYPE_TIMELINE } from './timeline-view';

/**
 * 在标签页中打开 Timeline 视图，并绑定到指定视图配置文件。
 * 若该配置文件已有打开的 Timeline 视图，则复用其 leaf（避免重复开标签页）。
 * @param plugin 插件实例（经 register 机制注册的入口调用）。
 * @param file 视图配置文件（必须是 frontmatter 含 timeline: true 的文件）。
 */
export async function openTimelineView(plugin: Plugin, file: TFile): Promise<void> {
	const existing = plugin.app.workspace
		.getLeavesOfType(VIEW_TYPE_TIMELINE)
		.find((leaf) => {
			const state = leaf.getViewState().state as { filePath?: string } | null;
			return state?.filePath === file.path;
		});

	if (existing !== undefined) {
		plugin.app.workspace.setActiveLeaf(existing, { focus: true });
		return;
	}

	const leaf = plugin.app.workspace.getLeaf('tab');
	await leaf.setViewState({
		type: VIEW_TYPE_TIMELINE,
		active: true,
		state: { filePath: file.path },
	});
	await plugin.app.workspace.revealLeaf(leaf);
}
