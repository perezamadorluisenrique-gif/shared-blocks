import type { Messages } from '../i18n.ts';

const ko: Messages = {
  // Commands
  'command.refreshAll': '모든 블록 새로 고침',
  'command.insertReference': '블록 참조 삽입',
  'command.shareSelection': '선택 영역을 공유 블록으로 만들기',
  'command.openDefinition': '이 줄이 참조하는 블록 열기',
  'command.showCacheStats': '캐시 통계 표시',

  // Notices
  'notice.refreshed': '공유 블록을 새로 고쳤습니다',
  'notice.cacheStats.one': '공유 블록: 캐시에 블록 1개',
  'notice.cacheStats.other': '공유 블록: 캐시에 블록 {count}개',
  'notice.noBlocks': 'Shared Blocks: 아직 정의된 블록이 없습니다. 텍스트를 선택하고 "{command}"을(를) 실행하세요.',
  'notice.created': '공유 블록 "{name}"을(를) 만들었습니다. 참조를 복사했습니다: {ref}',
  'notice.createdNotCopied': '공유 블록 "{name}"을(를) 만들었습니다. 참조: {ref}',
  'notice.refsUpdated.one': 'Shared Blocks: 노트 1개에서 참조 1개를 업데이트했습니다.',
  'notice.refsUpdated.manyInOne': 'Shared Blocks: 노트 1개에서 참조 {refs}개를 업데이트했습니다.',
  'notice.refsUpdated.manyInMany': 'Shared Blocks: 노트 {notes}개에서 참조 {refs}개를 업데이트했습니다.',
  'notice.noteNotFound': 'Shared Blocks: 노트 "{note}"을(를) 찾을 수 없습니다.',
  'notice.blockNotFound': 'Shared Blocks: "{note}"에서 블록 "{block}"을(를) 찾을 수 없습니다.',

  // Shown in place of a reference that cannot be drawn
  'error.noteNotFound': '노트 "{note}"을(를) 찾을 수 없습니다',
  'error.blockNotFound': '"{note}"에서 블록 "{block}"을(를) 찾을 수 없습니다',
  'error.circular': '순환 참조: {note}^{block}',
  'error.render': '블록을 렌더링하는 중 오류가 발생했습니다',

  // Dialogs
  'modal.searchPlaceholder': '이름, 노트, 텍스트로 공유 블록 검색',
  'modal.blockName': '블록 이름',
  'modal.share': '공유',
  'modal.invalidName': '영문자, 숫자, _, -만 쓸 수 있으며 공백은 쓸 수 없습니다.',
  'modal.nameTaken': '이 노트에는 "{name}"(이)라는 이름의 블록이 이미 있습니다.',
};

export default ko;
