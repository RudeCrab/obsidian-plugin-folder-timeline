/**
 * Base 视图：TimelineBasesView。
 *
 * 作为 Obsidian Base 的自定义视图类型，出现在 Base 的 Layout → + Add View 菜单中。
 * 复用 GanttRenderer 与 from-base 转换器，渲染逻辑与独立 TimelineView 一致。
 *
 * DOM 策略参考 obsidian-power-bases：在 containerEl 内创建 rootEl，
 * 所有渲染操作限定在 rootEl 内，不动 Base 管理的 containerEl。
 *
 * 配置选项（经 Base 视图设置面板暴露）：
 * - startField：开始时间属性（property picker）
 * - endField：结束时间属性（property picker）
 * - showFileName：是否显示文件名（toggle）
 * - displayMode：默认显示模式（dropdown：year / month / day）
 */
import {
	BasesView,
	type BasesAllOptions,
	type BasesEntry,
	type BasesViewConfig,
	type Plugin,
	type QueryController,
} from 'obsidian';
import type { DisplayMode } from '../config';
import { t } from '../i18n';
import type { TimelineItem } from '../data';
import { GanttRenderer } from './gantt';
import { basesEntriesToTimelineItems } from './from-base';

/** Base 视图类型标识（用于 registerBasesView 的 viewId）。 */
export const BASES_VIEW_TYPE = 'folder-timeline';

/** 显示模式标签（每次调用时求值，支持运行时切换语言）。 */
function modeOptions(): Record<string, string> {
	return {
		year: t('view.modeYear'),
		month: t('view.modeMonth'),
		day: t('view.modeDay'),
	};
}

/** 从 BasesView.data 安全提取 BasesEntry[]。
 *  view.data 在运行期即为 BasesQueryResult，`.data` 直接返回 BasesEntry[]。 */
function extractEntries(view: BasesView): BasesEntry[] {
	return view.data.data;
}

/** 从 BasesViewConfig 读取字符串值。 */
function configString(config: BasesViewConfig, key: string, fallback: string): string {
	const value = config.get(key);
	return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/** 从 BasesViewConfig 读取布尔值。 */
function configBool(config: BasesViewConfig, key: string, fallback: boolean): boolean {
	const value = config.get(key);
	return typeof value === 'boolean' ? value : fallback;
}

/** 构建 BasesViewRegistration 的 options 列表。 */
export function timelineBaseViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
	return [
		{
			type: 'property',
			key: 'startField',
			displayName: t('view.startFieldLabel'),
			placeholder: t('base.startFieldPlaceholder'),
		},
		{
			type: 'property',
			key: 'endField',
			displayName: t('view.endFieldLabel'),
			placeholder: t('base.endFieldPlaceholder'),
		},
		{
			type: 'toggle',
			key: 'showFileName',
			displayName: t('view.showFileNameLabel'),
			default: true,
		},
		{
			type: 'dropdown',
			key: 'displayMode',
			displayName: t('view.displayModeLabel'),
			default: 'month',
			options: modeOptions(),
		},
	];
}

/** Timeline Base 视图：把 Base 查询结果渲染为 Gantt 时间轴。 */
export class TimelineBasesView extends BasesView {
	type = BASES_VIEW_TYPE;

	/** 自己的根 DOM 元素，在 containerEl 内部创建，渲染限定于此。 */
	private rootEl: HTMLElement;
	/** 插件实例引用（语言切换时批量重渲染用）。 */
	private plugin: Plugin;
	/** 视图内显示模式覆盖（不写回配置，与 ItemView 的 overrideMode 行为一致）。 */
	private overrideMode: DisplayMode | null = null;
	private gantt: GanttRenderer | null = null;

	constructor(plugin: Plugin, controller: QueryController, containerEl: HTMLElement) {
		super(controller);
		this.plugin = plugin;
		// timeline-view 类使现有 Gantt CSS 规则（.timeline-view .tl-gantt-*）生效。
		this.rootEl = containerEl.createDiv({ cls: 'tl-base-root timeline-view' });
	}

	onDataUpdated(): void {
		this.renderGantt();
	}

	onunload(): void {
		this.destroyGantt();
		this.rootEl.remove();
		(this.plugin as { liveBasesViews?: Set<TimelineBasesView> }).liveBasesViews?.delete(this);
	}

	/** 主渲染：读取配置 → 转换条目 → 渲染 Gantt。 */
	private renderGantt(): void {
		try {
			this.renderGanttUnsafe();
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			this.rootEl.empty();
			this.rootEl.createDiv({
				cls: 'tl-section tl-error',
				text: `Render error: ${msg}`,
			});
		}
	}

	private renderGanttUnsafe(): void {
		const root = this.rootEl;
		this.destroyGantt();
		root.empty();

		const entries = extractEntries(this);
		if (entries.length === 0) {
			root.createDiv({ cls: 'tl-empty', text: t('base.noEntries') });
			return;
		}

		const startPropId = this.config.getAsPropertyId('startField');
		const endPropId = this.config.getAsPropertyId('endField');
		const showFileName = configBool(this.config, 'showFileName', true);
		const displayModeRaw = configString(this.config, 'displayMode', 'month');

		if (startPropId === null || endPropId === null) {
			root.createDiv({
				cls: 'tl-section tl-error',
				text: t('base.configRequired'),
			});
			return;
		}

		const configMode = (displayModeRaw as DisplayMode) || 'month';
		const displayMode = this.overrideMode ?? configMode;

		const items = basesEntriesToTimelineItems(this.app, entries, startPropId, endPropId);
		const valid = items.filter((item) => item.status === 'valid');
		const skipped = items.filter((item) => item.status === 'skipped');

		if (valid.length === 0) {
			this.renderSummary(root, items.length, valid.length, skipped);
			return;
		}

		this.renderSummary(root, items.length, valid.length, skipped);
		this.renderModeToolbar(root, displayMode);

		const ganttContainer = root.createDiv({ cls: 'tl-gantt' });
		this.gantt = new GanttRenderer(ganttContainer, {
			items: valid,
			mode: displayMode,
			showFileName,
			startField: startPropId,
			endField: endPropId,
			onOpenFile: (item) => this.openItem(item),
		});
	}

	/** 统计摘要 + 跳过清单。 */
	private renderSummary(
		container: HTMLElement,
		total: number,
		valid: number,
		skipped: TimelineItem[],
	): void {
		const stats = container.createDiv({ cls: 'tl-section' });
		stats.createDiv({
			text: t('view.statsFormat', { total, valid, skipped: skipped.length }),
		});

		if (skipped.length > 0) {
			const details = stats.createEl('details');
			details.createEl('summary', {
				text: t('view.skippedFiles', { count: skipped.length }),
			});
			const list = details.createEl('ul', { cls: 'tl-skipped-list' });
			for (const item of skipped) {
				list.createEl('li', {
					text: `${item.file.path} — ${item.reason ?? t('view.unknownReason')}`,
				});
			}
		}
	}

	/** 显示模式工具栏。 */
	private renderModeToolbar(container: HTMLElement, current: DisplayMode): void {
		const modes: readonly DisplayMode[] = ['year', 'month', 'day'];
		const labels = modeOptions();
		const toolbar = container.createDiv({ cls: 'tl-toolbar' });
		const group = toolbar.createDiv({ cls: 'tl-toolbar-group' });

		for (const mode of modes) {
			const button = group.createEl('button', {
				cls: mode === current ? 'tl-mode-btn is-active' : 'tl-mode-btn',
				text: labels[mode],
				attr: {
					type: 'button',
					'aria-pressed': mode === current ? 'true' : 'false',
				},
			});
			button.addEventListener('click', () => {
				this.rebuildWithMode(mode);
			});
		}
	}

	/** 以指定显示模式重建 Gantt（视图内覆盖，不写回配置）。 */
	private rebuildWithMode(mode: DisplayMode): void {
		this.overrideMode = mode;
		this.renderGantt();
	}

	/** 打开条目对应文件。 */
	private openItem(item: TimelineItem): void {
		const leaf = this.app.workspace.getLeaf('tab');
		void leaf.openFile(item.file);
	}

	/** 销毁 Gantt 渲染器。 */
	private destroyGantt(): void {
		if (this.gantt !== null) {
			this.gantt.destroy();
			this.gantt = null;
		}
	}
}
