import type { Messages } from '../i18n.ts';

const fr: Messages = {
  // Commands
  'command.refreshAll': 'Actualiser tous les blocs',
  'command.insertReference': 'Insérer une référence à un bloc',
  'command.shareSelection': 'Partager la sélection comme bloc',
  'command.openDefinition': 'Ouvrir le bloc référencé sur cette ligne',
  'command.showCacheStats': 'Afficher les statistiques du cache',

  // Notices
  'notice.refreshed': 'Blocs partagés actualisés',
  'notice.cacheStats.one': 'Blocs partagés : 1 bloc en cache',
  'notice.cacheStats.other': 'Blocs partagés : {count} blocs en cache',
  'notice.noBlocks': 'Shared Blocks : aucun bloc défini pour l’instant. Sélectionnez du texte et lancez « {command} ».',
  'notice.created': 'Bloc partagé « {name} » créé. Référence copiée : {ref}',
  'notice.createdNotCopied': 'Bloc partagé « {name} » créé. Référence : {ref}',
  'notice.refsUpdated.one': 'Shared Blocks : 1 référence mise à jour dans 1 note.',
  'notice.refsUpdated.manyInOne': 'Shared Blocks : {refs} références mises à jour dans 1 note.',
  'notice.refsUpdated.manyInMany': 'Shared Blocks : {refs} références mises à jour dans {notes} notes.',
  'notice.noteNotFound': 'Shared Blocks : note « {note} » introuvable.',
  'notice.blockNotFound': 'Shared Blocks : bloc « {block} » introuvable dans « {note} ».',

  // Shown in place of a reference that cannot be drawn
  'error.noteNotFound': 'Note « {note} » introuvable',
  'error.blockNotFound': 'Bloc « {block} » introuvable dans « {note} »',
  'error.circular': 'Référence circulaire : {note}^{block}',
  'error.render': 'Erreur lors de l’affichage du bloc',

  // Dialogs
  'modal.searchPlaceholder': 'Rechercher des blocs partagés par nom, note ou texte',
  'modal.blockName': 'Nom du bloc',
  'modal.share': 'Partager',
  'modal.invalidName': 'Utilisez uniquement des lettres, des chiffres, _ et -, sans espaces.',
  'modal.nameTaken': 'Cette note a déjà un bloc nommé « {name} ».',
};

export default fr;
