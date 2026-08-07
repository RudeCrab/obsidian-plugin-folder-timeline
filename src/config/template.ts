/**
 * 视图配置文件模板生成（纯函数）。
 *
 * 模板字段与主提示词第四节一致；`folder` 在触发时自动填入目标目录的相对路径。
 * 注释与引导文案随插件语言翻译。
 */
import { t } from '../i18n';

/**
 * 生成视图配置文件的 Markdown 内容。
 * @param folder 目标目录相对 vault 根目录的路径；空字符串表示 vault 根。
 */
export function buildConfigTemplate(folder: string): string {
	// JSON.stringify 保证任意路径（含引号、换行等特殊字符）都能安全嵌入 YAML 双引号字符串。
	const folderYaml = JSON.stringify(folder);
	return [
		'---',
		'timeline: true',
		`folder: ${folderYaml}   # ${t('template.folderComment')}`,
		`recursive: false   # ${t('template.recursiveComment')}`,
		`startField: "start"   # ${t('template.startFieldComment')}`,
		`endField: "end"       # ${t('template.endFieldComment')}`,
		`showFileName: true    # ${t('template.showFileNameComment')}`,
		`displayMode: "month"  # ${t('template.displayModeComment')}`,
		`sortBy: "start"       # ${t('template.sortByComment')}`,
		`sortOrder: "asc"      # ${t('template.sortOrderComment')}`,
		'---',
	].join('\n');
}
