import assert from 'node:assert/strict';
import test from 'node:test';

import {
  blockCacheKey,
  blockNameFromKey,
  changedBlockNames,
  keyBelongsToFile,
  parseBlocks,
  parseRef,
  rekey,
} from '../src/blocks.ts';

const block = (name: string, body: string) =>
  `==share:${name}==\n${body}\n==/share==`;

test('parseBlocks reads a single block', () => {
  const blocks = parseBlocks(`Intro\n\n${block('notas', 'Hola')}\n\nOutro`);

  assert.deepEqual([...blocks], [['notas', 'Hola']]);
});

test('parseBlocks reads several blocks from one note', () => {
  const content = `${block('uno', 'Primero')}\n\n${block('dos', 'Segundo')}`;

  assert.deepEqual(
    [...parseBlocks(content)],
    [['uno', 'Primero'], ['dos', 'Segundo']],
  );
});

test('parseBlocks keeps multi-line content and trims the edges', () => {
  const blocks = parseBlocks(block('lista', '\n- uno\n- dos\n'));

  assert.equal(blocks.get('lista'), '- uno\n- dos');
});

test('parseBlocks accepts accented and non-Latin names', () => {
  const blocks = parseBlocks(`${block('café', 'a')}\n${block('日本語', 'b')}`);

  assert.equal(blocks.get('café'), 'a');
  assert.equal(blocks.get('日本語'), 'b');
});

test('parseBlocks skips an empty block', () => {
  // A block with no body is a half-written block. Rendering nothing where
  // the reader expects content hides the mistake.
  assert.equal(parseBlocks(block('vacio', '   ')).size, 0);
});

test('parseBlocks ignores an unterminated block', () => {
  assert.equal(parseBlocks('==share:abierto==\nsin cierre\n').size, 0);
});

test('parseBlocks ignores a marker that is not at the start of a line', () => {
  assert.equal(parseBlocks('texto ==share:x==\ncuerpo\n==/share==').size, 0);
});

test('parseBlocks reads a note with Windows line endings', () => {
  const blocks = parseBlocks('Intro\r\n==share:crlf==\r\nuno\r\ndos\r\n==/share==\r\n');
  assert.deepEqual([...blocks], [['crlf', 'uno\ndos']]);
});

test('parseBlocks tolerates trailing spaces after a marker', () => {
  const blocks = parseBlocks('==share:espacio==  \ncuerpo\n==/share==\t\n');
  assert.deepEqual([...blocks], [['espacio', 'cuerpo']]);
});

test('parseBlocks has no state between calls', () => {
  // The regex is global; a shared instance would skip matches on the
  // second call because of its lastIndex.
  const content = `${block('uno', 'a')}\n${block('dos', 'b')}`;

  assert.deepEqual([...parseBlocks(content)], [...parseBlocks(content)]);
});

test('parseRef reads a reference', () => {
  assert.deepEqual(parseRef('ref:Mi nota^resumen'), {
    noteName: 'Mi nota',
    blockName: 'resumen',
  });
});

test('parseRef reads a reference into a subfolder', () => {
  assert.deepEqual(parseRef('ref:Proyectos/Plugins^estado'), {
    noteName: 'Proyectos/Plugins',
    blockName: 'estado',
  });
});

test('parseRef accepts an accented block name', () => {
  // Without the Unicode flag this fell through and the reference rendered
  // as plain text, even though the block itself parsed fine.
  assert.deepEqual(parseRef('ref:Nota^café'), {
    noteName: 'Nota',
    blockName: 'café',
  });
});

test('parseRef tolerates surrounding whitespace', () => {
  assert.deepEqual(parseRef('  ref:Nota^bloque  '), {
    noteName: 'Nota',
    blockName: 'bloque',
  });
});

test('parseRef rejects text that is not a reference', () => {
  for (const text of ['resaltado', 'ref:Nota', 'ref:^bloque', 'Nota^bloque', '']) {
    assert.equal(parseRef(text), null, text);
  }
});

test('cache keys round-trip through a path that contains the separator', () => {
  const key = blockCacheKey('notas::raras/a.md', 'bloque');

  assert.equal(blockNameFromKey(key), 'bloque');
  assert.ok(keyBelongsToFile(key, 'notas::raras/a.md'));
});

test('keyBelongsToFile does not match a note with a longer name', () => {
  assert.equal(keyBelongsToFile(blockCacheKey('nota2.md', 'b'), 'nota'), false);
});

test('rekey moves a key to the new path', () => {
  assert.equal(
    rekey(blockCacheKey('viejo.md', 'bloque'), 'nuevo/sitio.md'),
    blockCacheKey('nuevo/sitio.md', 'bloque'),
  );
});

test('changedBlockNames reports added, removed and edited blocks', () => {
  const before = new Map([['igual', 'a'], ['editado', 'antes'], ['borrado', 'x']]);
  const after = new Map([['igual', 'a'], ['editado', 'despues'], ['nuevo', 'y']]);

  assert.deepEqual(
    changedBlockNames(before, after).sort(),
    ['borrado', 'editado', 'nuevo'],
  );
});

test('changedBlockNames reports nothing when a note changes elsewhere', () => {
  // An edit to prose around a block must not re-render its references.
  const blocks = new Map([['uno', 'a']]);

  assert.deepEqual(changedBlockNames(blocks, new Map(blocks)), []);
});
