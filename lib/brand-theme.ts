/**
 * 哪些主题使用 DeepSeek 品牌图标（鲸鱼徽标、思考图标、站点图标）。
 *
 * 保持 import-free，便于测试用 node 的类型剥离直接加载。
 */
export function usesDeepSeekBrand(theme: string): boolean {
  return theme === "deepseek" || theme === "deepseek-light";
}
