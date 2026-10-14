import type { Messages } from '../i18n.ts';

const ja: Messages = {
  // Commands
  'command.refreshAll': 'すべてのブロックを更新',
  'command.insertReference': 'ブロックへの参照を挿入',
  'command.shareSelection': '選択範囲を共有ブロックにする',
  'command.openDefinition': 'この行が参照しているブロックを開く',
  'command.showCacheStats': 'キャッシュの状況を表示',

  // Notices
  'notice.refreshed': '共有ブロックを更新しました',
  'notice.cacheStats.one': '共有ブロック: キャッシュ内に 1 件のブロック',
  'notice.cacheStats.other': '共有ブロック: キャッシュ内に {count} 件のブロック',
  'notice.noBlocks': 'Shared Blocks: まだブロックが定義されていません。テキストを選択して「{command}」を実行してください。',
  'notice.created': '共有ブロック「{name}」を作成しました。参照をコピーしました: {ref}',
  'notice.createdNotCopied': '共有ブロック「{name}」を作成しました。参照: {ref}',
  'notice.refsUpdated.one': 'Shared Blocks: 1 件のノートで 1 件の参照を更新しました。',
  'notice.refsUpdated.manyInOne': 'Shared Blocks: 1 件のノートで {refs} 件の参照を更新しました。',
  'notice.refsUpdated.manyInMany': 'Shared Blocks: {notes} 件のノートで {refs} 件の参照を更新しました。',
  'notice.noteNotFound': 'Shared Blocks: ノート「{note}」が見つかりません。',
  'notice.blockNotFound': 'Shared Blocks: ブロック「{block}」が「{note}」に見つかりません。',

  // Shown in place of a reference that cannot be drawn
  'error.noteNotFound': 'ノート「{note}」が見つかりません',
  'error.blockNotFound': 'ブロック「{block}」が「{note}」に見つかりません',
  'error.circular': '循環参照: {note}^{block}',
  'error.render': 'ブロックの描画中にエラーが発生しました',

  // Dialogs
  'modal.searchPlaceholder': '名前、ノート、テキストで共有ブロックを検索',
  'modal.blockName': 'ブロック名',
  'modal.share': '共有',
  'modal.invalidName': '英数字、_、- のみ使用できます。スペースは使えません。',
  'modal.nameTaken': 'このノートには「{name}」という名前のブロックがすでにあります。',
};

export default ja;
