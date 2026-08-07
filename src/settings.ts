/**
 * 插件设置：目前仅含界面语言选项。
 *
 * 语言默认英语（en）；可选「跟随系统 / 英语 / 中文」。
 * 采用 Obsidian 1.13+ 声明式设置 API（getSettingDefinitions）。
 */
import { PluginSettingTab, type App, type SettingDefinitionItem } from 'obsidian';
import type SimpleTimelinePlugin from './main';
import { resolveLocale, setLocale, t, type LanguageSetting } from './i18n';

/** 插件设置结构。 */
export interface SimpleTimelineSettings {
	/** 界面语言偏好：system = 跟随系统，en = 英语，zh = 中文。 */
	language: LanguageSetting;
}

/** 默认设置：语言默认为英语。 */
export const DEFAULT_SETTINGS: SimpleTimelineSettings = {
	language: 'en',
};

/** 设置面板：语言下拉选择（声明式 API）。 */
export class SimpleTimelineSettingTab extends PluginSettingTab {
	private plugin: SimpleTimelinePlugin;

	constructor(app: App, plugin: SimpleTimelinePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{
				name: t('settings.language'),
				desc: t('settings.languageDesc'),
				control: {
					type: 'dropdown',
					key: 'language',
					options: {
						system: t('settings.langSystem'),
						en: t('settings.langEnglish'),
						zh: t('settings.langChinese'),
					},
				},
			},
		];
	}

	getControlValue(key: string): unknown {
		if (key === 'language') return this.plugin.settings.language;
		return undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		if (key !== 'language') return;
		this.plugin.settings.language = value as LanguageSetting;
		await this.plugin.saveData(this.plugin.settings);
		setLocale(resolveLocale(this.plugin.settings.language));
		// 刷新已打开的 Timeline 视图，并使设置面板选项标签随语言更新。
		this.plugin.refreshOpenViews();
		this.update();
	}
}
