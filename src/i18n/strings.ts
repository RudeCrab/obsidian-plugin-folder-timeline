/**
 * 翻译表与查表函数（与 index.ts 分离，便于类型推导与保持字典完整性）。
 *
 * 以 en 为 key 的权威来源；zh 必须覆盖全部 key（类型系统强制），
 * 缺失的 key 在编译期即报错。
 */

/** 英语为权威来源，keyof 推导全部字符串键。 */
const en = {
	// 视图
	'view.name': 'Timeline',
	'view.noConfigAssociated': 'No view config file associated. Open via the ribbon icon or folder right-click.',
	'view.configNotFound': 'Config file does not exist: {{path}}',
	'view.noFrontmatter': 'This file has no frontmatter, so it is not a valid Timeline view config file.',
	'view.frontmatterParseFailed': 'Frontmatter parsing failed: {{error}}',
	'view.folderNotFound': 'Folder does not exist: {{folder}}',
	'view.notADirectory': '"{{folder}}" is not a directory.',
	'view.configTitle': 'Config',
	'view.folderPlaceholder': 'Relative to vault root; leave empty for root',
	'view.folderLabel': 'Folder',
	'view.startFieldLabel': 'Start Field',
	'view.endFieldLabel': 'End Field',
	'view.showFileNameLabel': 'Show File Name',
	'view.recursiveLabel': 'Recursive',
	'view.displayModeLabel': 'Display Mode',
	'view.sortByLabel': 'Sort by',
	'view.sortByCreated': 'File created',
	'view.sortByModified': 'File modified',
	'view.sortByStart': 'Start field',
	'view.sortByEnd': 'End field',
	'view.sortOrderLabel': 'Sort order',
	'view.sortOrderAsc': 'Ascending',
	'view.sortOrderDesc': 'Descending',
	'view.modeYear': 'Year',
	'view.modeMonth': 'Month',
	'view.modeDay': 'Day',
	'view.saveConfig': 'Save config',
	'view.fieldsRequired': 'Target folder, start field, and end field cannot be empty',
	'view.showSource': 'Show source',
	'view.configMissingSave': 'Config file does not exist; cannot save',
	'view.noFrontmatterSave': 'This file has no frontmatter; cannot save config',
	'view.configSaved': 'Config saved; view refreshed',
	'view.showView': 'Show view',
	'view.readonlyHint': 'Config file source (read-only). Edit config via the form in "Show view".',
	'view.noConfig': 'No config file associated',
	'view.configInvalid': 'Invalid config file',
	'view.configErrorField': 'Field "{{field}}": {{message}}',
	'view.error': 'Error',
	'view.emptyFolder': 'No Markdown files under "{{folder}}".',
	'view.fileStats': 'File stats',
	'view.statsFormat': '{{total}} files, {{valid}} valid, {{skipped}} skipped',
	'view.skippedFiles': 'Skipped Files ({{count}})',
	'view.unknownReason': 'unknown reason',
	'view.noValidItems': 'No valid files to render (all files skipped; see reasons above).',
	'view.cannotOpenFile': 'Cannot open file: {{error}}',
	'view.vaultRoot': 'vault root',
	'view.vaultRootParens': '(vault root)',

	// 配置解析错误
	'config.errNotObject': 'Frontmatter is not a valid YAML object. Check the config block at the top of the file.',
	'config.errTimelineTrue': 'timeline must be true, otherwise this file will not be recognized as a Timeline view config file.',
	'config.errMissingField': 'Missing required field: {{field}}',
	'config.errMustBeString': '{{field}} must be a string; current type is {{type}}',
	'config.errRecursiveBool': 'recursive must be a boolean; current type is {{type}}',
	'config.errShowFileNameBool': 'showFileName must be a boolean; current type is {{type}}',
	'config.errDisplayMode': 'displayMode must be one of "year", "month", or "day"; current value is {{value}}',
	'config.errSortBy': 'sortBy must be one of "created", "modified", "start", or "end"; current value is {{value}}',
	'config.errSortOrder': 'sortOrder must be "asc" or "desc"; current value is {{value}}',

	// 配置文件模板
	'template.folderComment': 'Folder to display (relative to vault root; empty string means vault root)',
	'template.recursiveComment': 'Whether to scan subfolders recursively (false = current folder only, true = include all subfolders)',
	'template.startFieldComment': 'Start date field name',
	'template.endFieldComment': 'End date field name',
	'template.showFileNameComment': 'Whether to show the file name on the timeline bar',
	'template.displayModeComment': 'Timeline scale: year | month | day',
	'template.sortByComment': 'Sort bars by: created | modified | start | end',
	'template.sortOrderComment': 'Sort order: asc | desc',

	// 配置 / 命令
	'config.fileName': 'Timeline View',
	'ribbon.tooltip': 'open or create a timeline view',
	'menu.createInFolder': 'Open or create timeline view in this folder',
	'notice.configCreated': 'Created Timeline view config file: {{path}}',
	'notice.unknownError': 'unknown error',
	'notice.frontmatterParseFailed': 'Frontmatter parsing failed for "{{name}}": {{error}}',
	'notice.folderNotFound': 'Folder does not exist: {{folder}}',

	// 条目构建跳过原因
	'build.frontmatterParseFailed': 'Frontmatter parsing failed: {{error}}',
	'build.noFrontmatter': 'File has no frontmatter',
	'build.missingStartField': 'Missing start date field "{{field}}"',
	'build.startNotDate': 'Start date field "{{field}}" cannot be parsed as a date (value: {{value}})',
	'build.endNotDate': 'End date field "{{field}}" cannot be parsed as a date (value: {{value}})',
	'build.startAfterEnd': 'Start time is after end time',

	// 设置
	// Base 视图
	'base.noEntries': 'No entries found. Check the Base query configuration.',
	'base.configRequired': 'Please configure both Start Field and End Field in the view options to display the timeline.',
	'base.startFieldPlaceholder': 'Select start date property...',
	'base.endFieldPlaceholder': 'Select end date property...',

	'settings.language': 'Language',
	'settings.languageDesc': 'Interface language. "Follow system" uses your Obsidian / app language.',
	'settings.langSystem': 'Follow system',
	'settings.langEnglish': 'English',
	'settings.langChinese': 'Chinese',
} as const;

export type I18nKey = keyof typeof en;

/** 中文翻译：必须覆盖 en 的全部 key（缺失将在编译期报错）。 */
const zh: Record<I18nKey, string> = {
	'view.name': '时间轴',
	'view.noConfigAssociated': '未关联视图配置文件（通过 Ribbon 图标或目录右键打开）。',
	'view.configNotFound': '配置文件不存在：{{path}}',
	'view.noFrontmatter': '该文件没有 frontmatter，不是有效的 Timeline 视图配置文件。',
	'view.frontmatterParseFailed': 'frontmatter 解析失败：{{error}}',
	'view.folderNotFound': '目录不存在：{{folder}}',
	'view.notADirectory': '「{{folder}}」不是目录。',
	'view.configTitle': '配置',
	'view.folderPlaceholder': '相对 vault 根目录，留空 = 根目录',
	'view.folderLabel': '目录路径',
	'view.startFieldLabel': '开始字段',
	'view.endFieldLabel': '结束字段',
	'view.showFileNameLabel': '显示文件名',
	'view.recursiveLabel': '递归扫描',
	'view.displayModeLabel': '默认显示模式',
	'view.sortByLabel': '排序依据',
	'view.sortByCreated': '文件创建时间',
	'view.sortByModified': '文件修改时间',
	'view.sortByStart': '开始字段',
	'view.sortByEnd': '结束字段',
	'view.sortOrderLabel': '排序方向',
	'view.sortOrderAsc': '正序（升序）',
	'view.sortOrderDesc': '倒序（降序）',
	'view.modeYear': '年',
	'view.modeMonth': '月',
	'view.modeDay': '日',
	'view.saveConfig': '保存配置',
	'view.fieldsRequired': '目标目录、开始字段、结束字段不能为空',
	'view.showSource': '显示原文',
	'view.configMissingSave': '配置文件不存在，无法保存',
	'view.noFrontmatterSave': '该文件没有 frontmatter，无法保存配置',
	'view.configSaved': '配置已保存，视图已刷新',
	'view.showView': '显示视图',
	'view.readonlyHint': '配置文件原文（只读）：修改配置请在「显示视图」中的表单操作',
	'view.noConfig': '未关联配置文件',
	'view.configInvalid': '配置文件无效',
	'view.configErrorField': '字段「{{field}}」：{{message}}',
	'view.error': '错误',
	'view.emptyFolder': '目录「{{folder}}」下没有 Markdown 文件。',
	'view.fileStats': '文件统计',
	'view.statsFormat': '共 {{total}} 个文件，{{valid}} 个有效，{{skipped}} 个跳过',
	'view.skippedFiles': '被跳过的文件（{{count}}）',
	'view.unknownReason': '未知原因',
	'view.noValidItems': '没有可渲染的有效文件（全部文件被跳过，见上方原因）。',
	'view.cannotOpenFile': '无法打开文件：{{error}}',
	'view.vaultRoot': 'vault 根目录',
	'view.vaultRootParens': '（vault 根目录）',

	'config.errNotObject': 'frontmatter 不是有效的 YAML 对象，请检查文件开头的配置块',
	'config.errTimelineTrue': 'timeline 必须为 true，否则该文件不会被识别为 Timeline 视图配置文件',
	'config.errMissingField': '缺少必填字段 {{field}}',
	'config.errMustBeString': '{{field}} 必须是字符串，当前类型为 {{type}}',
	'config.errRecursiveBool': 'recursive 必须是布尔值，当前类型为 {{type}}',
	'config.errShowFileNameBool': 'showFileName 必须是布尔值，当前类型为 {{type}}',
	'config.errDisplayMode': 'displayMode 必须是 "year"、"month" 或 "day" 之一，当前为 {{value}}',
	'config.errSortBy': 'sortBy 必须是 "created"、"modified"、"start" 或 "end" 之一，当前为 {{value}}',
	'config.errSortOrder': 'sortOrder 必须是 "asc" 或 "desc"，当前为 {{value}}',

	'template.folderComment': '要展示的目录（相对 vault 根，空字符串表示 vault 根）',
	'template.recursiveComment': '是否递归扫描子目录（false=仅当前目录，true=包含所有子目录）',
	'template.startFieldComment': '开始时间字段名',
	'template.endFieldComment': '结束时间字段名',
	'template.showFileNameComment': '是否在时间条上显示文件名',
	'template.displayModeComment': '时间轴刻度：year | month | day',
	'template.sortByComment': '排序依据：created | modified | start | end',
	'template.sortOrderComment': '排序方向：asc | desc',

	'config.fileName': 'Timeline 视图',
	'ribbon.tooltip': '打开或创建Timeline视图',
	'menu.createInFolder': '在此目录打开或创建Timeline视图',
	'notice.configCreated': '已创建 Timeline 视图配置文件：{{path}}',
	'notice.unknownError': '未知错误',
	'notice.frontmatterParseFailed': '「{{name}}」的 frontmatter 解析失败：{{error}}',
	'notice.folderNotFound': '目录不存在：{{folder}}',

	'build.frontmatterParseFailed': 'frontmatter 解析失败：{{error}}',
	'build.noFrontmatter': '文件缺少 frontmatter',
	'build.missingStartField': '缺少开始时间字段「{{field}}」',
	'build.startNotDate': '开始时间字段「{{field}}」无法解析为日期（值：{{value}}）',
	'build.endNotDate': '结束时间字段「{{field}}」无法解析为日期（值：{{value}}）',
	'build.startAfterEnd': '开始时间晚于结束时间',

	'base.noEntries': '未找到条目，请检查 Base 查询配置。',
	'base.configRequired': '请在视图选项中配置「开始字段」与「结束字段」以显示时间轴。',
	'base.startFieldPlaceholder': '选择开始时间属性...',
	'base.endFieldPlaceholder': '选择结束时间属性...',

	'settings.language': '语言',
	'settings.languageDesc': '界面语言。「跟随系统」使用你的 Obsidian / 系统语言。',
	'settings.langSystem': '跟随系统',
	'settings.langEnglish': '英语',
	'settings.langChinese': '中文',
};

const STRINGS: Record<Locale, Record<I18nKey, string>> = { en, zh };

type Locale = 'en' | 'zh';

/** 查表并替换 {{var}} 占位符；缺失时回退英文，再回退 key 本身。 */
export function t(
	locale: Locale,
	key: I18nKey,
	vars?: Record<string, string | number>,
): string {
	let str = STRINGS[locale][key] ?? STRINGS.en[key] ?? key;
	if (vars !== undefined) {
		for (const [k, v] of Object.entries(vars)) {
			str = str.split(`{{${k}}}`).join(String(v));
		}
	}
	return str;
}
