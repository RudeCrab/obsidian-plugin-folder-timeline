/**
 * 国际化（i18n）模块。
 *
 * 支持语言：英语（en，默认）/ 中文（zh）。
 * 插件设置提供「跟随系统 / 英语 / 中文」三选项，由 resolveLocale 解析为最终语言。
 *
 * 本模块为纯运行时逻辑：不依赖 Obsidian 的 import（仅在 resolveLocale 内于运行期
 * 读取 window.moment / navigator.language），可在任意环境安全 import。
 */
import { t as translate, type I18nKey } from './strings';

/** 设置中的语言偏好。 */
export type LanguageSetting = 'system' | 'en' | 'zh';
/** 解析后的实际语言（en | zh）。 */
export type Locale = 'en' | 'zh';

let currentLocale: Locale = 'en';

/** 设置当前生效语言（插件加载 / 设置变更时调用）。 */
export function setLocale(locale: Locale): void {
	currentLocale = locale;
}

/** 由设置偏好解析实际语言；system 跟随 Obsidian / 系统语言。 */
export function resolveLocale(pref: LanguageSetting): Locale {
	if (pref === 'en') return 'en';
	if (pref === 'zh') return 'zh';
	return detectSystemLocale();
}

/** 检测系统语言：优先 Obsidian 的 moment.locale()，回退到 navigator.language。 */
function detectSystemLocale(): Locale {
	const momentLocale = getMomentLocale();
	const localeStr = momentLocale ?? (typeof navigator !== 'undefined' ? navigator.language : undefined) ?? 'en';
	return /^zh/i.test(localeStr) ? 'zh' : 'en';
}

function getMomentLocale(): string | undefined {
	const m = (window as unknown as { moment?: { locale: () => string } }).moment;
	return m ? m.locale() : undefined;
}

/** 取当前语言下的翻译字符串（支持 {{var}} 占位符替换）。 */
export function t(key: I18nKey, vars?: Record<string, string | number>): string {
	return translate(currentLocale, key, vars);
}
