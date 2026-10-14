import type { Messages } from '../i18n.ts';

const ptBR: Messages = {
  // Commands
  'command.refreshAll': 'Atualizar todos os blocos',
  'command.insertReference': 'Inserir referência a um bloco',
  'command.shareSelection': 'Compartilhar a seleção como bloco',
  'command.openDefinition': 'Abrir o bloco referenciado nesta linha',
  'command.showCacheStats': 'Mostrar estatísticas do cache',

  // Notices
  'notice.refreshed': 'Blocos compartilhados atualizados',
  'notice.cacheStats.one': 'Blocos compartilhados: 1 bloco no cache',
  'notice.cacheStats.other': 'Blocos compartilhados: {count} blocos no cache',
  'notice.noBlocks': 'Shared Blocks: nenhum bloco definido ainda. Selecione um texto e execute "{command}".',
  'notice.created': 'Bloco compartilhado "{name}" criado. Referência copiada: {ref}',
  'notice.createdNotCopied': 'Bloco compartilhado "{name}" criado. Referência: {ref}',
  'notice.refsUpdated.one': 'Shared Blocks: 1 referência atualizada em 1 nota.',
  'notice.refsUpdated.manyInOne': 'Shared Blocks: {refs} referências atualizadas em 1 nota.',
  'notice.refsUpdated.manyInMany': 'Shared Blocks: {refs} referências atualizadas em {notes} notas.',
  'notice.noteNotFound': 'Shared Blocks: nota "{note}" não encontrada.',
  'notice.blockNotFound': 'Shared Blocks: bloco "{block}" não encontrado em "{note}".',

  // Shown in place of a reference that cannot be drawn
  'error.noteNotFound': 'Nota "{note}" não encontrada',
  'error.blockNotFound': 'Bloco "{block}" não encontrado em "{note}"',
  'error.circular': 'Referência circular: {note}^{block}',
  'error.render': 'Erro ao renderizar o bloco',

  // Dialogs
  'modal.searchPlaceholder': 'Buscar blocos compartilhados por nome, nota ou texto',
  'modal.blockName': 'Nome do bloco',
  'modal.share': 'Compartilhar',
  'modal.invalidName': 'Use apenas letras, dígitos, _ e -, sem espaços.',
  'modal.nameTaken': 'Esta nota já tem um bloco chamado "{name}".',
};

export default ptBR;
