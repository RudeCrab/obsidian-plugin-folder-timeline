import { Plugin } from 'obsidian';
import { registerFolderContextMenu } from './commands/context-menu';
import { registerRibbonButton } from './commands/ribbon';
import { registerTimelineView, rerenderAllTimelineViews } from './views/timeline-view';
import {
	BASES_VIEW_TYPE,
	TimelineBasesView,
	timelineBaseViewOptions,
} from './views/timeline-base-view';
import { DEFAULT_SETTINGS, SimpleTimelineSettingTab, type SimpleTimelineSettings } from './settings';
import { resolveLocale, setLocale } from './i18n';

/**
 * Folder Timeline — Timeline/Gantt view plugin for Obsidian.
 */
export default class SimpleTimelinePlugin extends Plugin {
	settings!: SimpleTimelineSettings;
	/** 跟踪所有活跃的 TimelineBasesView，语言切换时批量重渲染。 */
	liveBasesViews = new Set<TimelineBasesView>();

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
		registerTimelineBasesView(this);
		this.addSettingTab(new SimpleTimelineSettingTab(this.app, this));
	}

	onunload() {}

	/** 重新渲染所有已打开的 Timeline 视图（语言切换后调用）。 */
	refreshOpenViews(): void {
		rerenderAllTimelineViews(this);
		for (const view of this.liveBasesViews) {
			view.onDataUpdated();
		}
	}
}

/** 注册 Timeline Base 视图类型。 */
function registerTimelineBasesView(plugin: SimpleTimelinePlugin): void {
	plugin.registerBasesView(BASES_VIEW_TYPE, {
		name: 'Timeline',
		icon: 'timeline',
		factory: (controller, containerEl) => {
			const view = new TimelineBasesView(plugin, controller, containerEl);
			plugin.liveBasesViews.add(view);
			return view;
		},
		options: timelineBaseViewOptions,
	});
}
