import { Plugin } from 'obsidian';
import { registerFolderContextMenu } from './commands/context-menu';
import { registerRibbonButton } from './commands/ribbon';
import { registerTimelineView, rerenderAllTimelineViews } from './views/timeline-view';
import { DEFAULT_SETTINGS, SimpleTimelineSettingTab, type SimpleTimelineSettings } from './settings';
import { resolveLocale, setLocale } from './i18n';

/**
 * Folder Timeline — Timeline/Gantt view plugin for Obsidian.
 *
 * - Ribbon button: recognizes / creates view config files, opens the Timeline view.
 * - FileExplorer folder context menu: creates a view config file for a folder, opens the view.
 * - Timeline ItemView renders the Gantt-style timeline.
 */
export default class SimpleTimelinePlugin extends Plugin {
	settings!: SimpleTimelineSettings;

	async onload() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<SimpleTimelineSettings>,
		);
		setLocale(resolveLocale(this.settings.language));

		registerRibbonButton(this);
		registerFolderContextMenu(this);
		registerTimelineView(this);
		this.addSettingTab(new SimpleTimelineSettingTab(this.app, this));
	}

	onunload() {}

	/** 重新渲染所有已打开的 Timeline 视图（语言切换后调用）。 */
	refreshOpenViews(): void {
		rerenderAllTimelineViews(this);
	}
}
