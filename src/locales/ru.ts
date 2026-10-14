import type { Messages } from '../i18n.ts';

const ru: Messages = {
  // Commands
  'command.refreshAll': 'Обновить все блоки',
  'command.insertReference': 'Вставить ссылку на блок',
  'command.shareSelection': 'Сделать выделенное общим блоком',
  'command.openDefinition': 'Открыть блок, на который указывает эта строка',
  'command.showCacheStats': 'Показать статистику кэша',

  // Notices
  'notice.refreshed': 'Общие блоки обновлены',
  'notice.cacheStats.one': 'Общие блоки: в кэше 1 блок',
  'notice.cacheStats.other': 'Общие блоки: блоков в кэше — {count}',
  'notice.noBlocks': 'Shared Blocks: блоки ещё не определены. Выделите текст и выполните «{command}».',
  'notice.created': 'Общий блок «{name}» создан. Ссылка скопирована: {ref}',
  'notice.createdNotCopied': 'Общий блок «{name}» создан. Ссылка: {ref}',
  'notice.refsUpdated.one': 'Shared Blocks: обновлена 1 ссылка в 1 заметке.',
  'notice.refsUpdated.manyInOne': 'Shared Blocks: обновлено ссылок: {refs}, в 1 заметке.',
  'notice.refsUpdated.manyInMany': 'Shared Blocks: обновлено ссылок: {refs}, в заметках: {notes}.',
  'notice.noteNotFound': 'Shared Blocks: заметка «{note}» не найдена.',
  'notice.blockNotFound': 'Shared Blocks: блок «{block}» не найден в «{note}».',

  // Shown in place of a reference that cannot be drawn
  'error.noteNotFound': 'Заметка «{note}» не найдена',
  'error.blockNotFound': 'Блок «{block}» не найден в «{note}»',
  'error.circular': 'Циклическая ссылка: {note}^{block}',
  'error.render': 'Ошибка отображения блока',

  // Dialogs
  'modal.searchPlaceholder': 'Поиск общих блоков по названию, заметке или тексту',
  'modal.blockName': 'Название блока',
  'modal.share': 'Сделать общим',
  'modal.invalidName': 'Используйте только буквы, цифры, _ и -, без пробелов.',
  'modal.nameTaken': 'В этой заметке уже есть блок с названием «{name}».',
};

export default ru;
