import type { Messages } from '../i18n.ts';

const zh: Messages = {
  // Commands
  'command.refreshAll': '刷新所有块',
  'command.insertReference': '插入对某个块的引用',
  'command.shareSelection': '将所选内容共享为块',
  'command.openDefinition': '打开此行引用的块',
  'command.showCacheStats': '显示缓存统计',

  // Notices
  'notice.refreshed': '共享块已刷新',
  'notice.cacheStats.one': '共享块：缓存中有 1 个块',
  'notice.cacheStats.other': '共享块：缓存中有 {count} 个块',
  'notice.noBlocks': 'Shared Blocks：还没有定义任何块。请选中一些文本并运行“{command}”。',
  'notice.created': '已创建共享块“{name}”。引用已复制：{ref}',
  'notice.createdNotCopied': '已创建共享块“{name}”。引用：{ref}',
  'notice.refsUpdated.one': 'Shared Blocks：已更新 1 条笔记中的 1 处引用。',
  'notice.refsUpdated.manyInOne': 'Shared Blocks：已更新 1 条笔记中的 {refs} 处引用。',
  'notice.refsUpdated.manyInMany': 'Shared Blocks：已更新 {notes} 条笔记中的 {refs} 处引用。',
  'notice.noteNotFound': 'Shared Blocks：找不到笔记“{note}”。',
  'notice.blockNotFound': 'Shared Blocks：在“{note}”中找不到块“{block}”。',

  // Shown in place of a reference that cannot be drawn
  'error.noteNotFound': '找不到笔记“{note}”',
  'error.blockNotFound': '在“{note}”中找不到块“{block}”',
  'error.circular': '循环引用：{note}^{block}',
  'error.render': '渲染块时出错',

  // Dialogs
  'modal.searchPlaceholder': '按名称、笔记或文本搜索共享块',
  'modal.blockName': '块名称',
  'modal.share': '共享',
  'modal.invalidName': '只能使用字母、数字、_ 和 -，不能有空格。',
  'modal.nameTaken': '此笔记中已有名为“{name}”的块。',
};

export default zh;
