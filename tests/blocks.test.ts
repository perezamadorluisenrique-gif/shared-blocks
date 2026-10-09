import assert from 'node:assert/strict';
import test from 'node:test';

import {
  blockCacheKey,
  blockNameFromKey,
  definitionLine,
  refLines,
  changedBlockNames,
  keyBelongsToFile,
  namesPath,
  parseBlocks,
  blockPlaceholders,
  fillPlaceholders,
  formatRefValue,
  parseRef,
  parseRefValues,
  rawRefTexts,
  valueStubs,
  rekey,
  retargetRefs,
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
    values: new Map(),
  });
});

test('parseRef reads a reference into a subfolder', () => {
  assert.deepEqual(parseRef('ref:Proyectos/Plugins^estado'), {
    noteName: 'Proyectos/Plugins',
    blockName: 'estado',
    values: new Map(),
  });
});

test('parseRef accepts an accented block name', () => {
  // Without the Unicode flag this fell through and the reference rendered
  // as plain text, even though the block itself parsed fine.
  assert.deepEqual(parseRef('ref:Nota^café'), {
    noteName: 'Nota',
    blockName: 'café',
    values: new Map(),
  });
});

test('parseRef tolerates surrounding whitespace', () => {
  assert.deepEqual(parseRef('  ref:Nota^bloque  '), {
    noteName: 'Nota',
    blockName: 'bloque',
    values: new Map(),
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

test('namesPath matches a note by name or by the end of its path', () => {
  assert.equal(namesPath('Handbook', 'Company/Handbook.md'), true);
  assert.equal(namesPath('Company/Handbook', 'Company/Handbook.md'), true);
  assert.equal(namesPath('handbook.md', 'Company/Handbook.md'), true);
  assert.equal(namesPath('book', 'Company/Handbook.md'), false);
  assert.equal(namesPath('Other/Handbook', 'Company/Handbook.md'), false);
});

test('retargetRefs rewrites matching references and counts them', () => {
  const rename = (name: string) => (name === 'Old' ? 'New' : null);
  const result = retargetRefs('a ==ref:Old^x== b ==ref: Old ^y==\n==ref:Other^x==', rename);
  assert.equal(result.text, 'a ==ref:New^x== b ==ref:New^y==\n==ref:Other^x==');
  assert.equal(result.count, 2);
});

test('retargetRefs leaves references in code alone', () => {
  const rename = (name: string) => (name === 'Old' ? 'New' : null);
  const text = '```\n==ref:Old^x==\n```\n`==ref:Old^x==` and ==ref:Old^x==';
  assert.equal(retargetRefs(text, rename).text, '```\n==ref:Old^x==\n```\n`==ref:Old^x==` and ==ref:New^x==');
});

import { isValidBlockName, refQueryAt, suggestBlockName, wrapAsBlock } from '../src/blocks.ts';

test('refQueryAt asks for a note right after ==ref:', () => {
  assert.deepEqual(refQueryAt('See ==ref:Comp'), { stage: 'note', query: 'Comp', start: 10 });
  assert.deepEqual(refQueryAt('==ref:'), { stage: 'note', query: '', start: 6 });
});

test('refQueryAt asks for a block after the caret', () => {
  assert.deepEqual(refQueryAt('==ref:Company handbook^con'), {
    stage: 'block',
    noteName: 'Company handbook',
    query: 'con',
    start: 23,
  });
  assert.deepEqual(refQueryAt('x ==ref:Folder/Note^'), {
    stage: 'block',
    noteName: 'Folder/Note',
    query: '',
    start: 20,
  });
});

test('refQueryAt ignores finished references and plain text', () => {
  assert.equal(refQueryAt('==ref:Note^block== and more'), null);
  assert.equal(refQueryAt('no reference here'), null);
  assert.equal(refQueryAt('==ref:^abc'), null);
  assert.equal(refQueryAt('==ref:Note^bad name'), null);
});

test('isValidBlockName accepts letters in any script, digits, _ and -', () => {
  assert.ok(isValidBlockName('contacto-oficina_2'));
  assert.ok(isValidBlockName('überblick'));
  assert.ok(!isValidBlockName('two words'));
  assert.ok(!isValidBlockName(''));
  assert.ok(!isValidBlockName('a^b'));
});

test('suggestBlockName takes the first words of the selection', () => {
  assert.equal(suggestBlockName('**Support:** support@example.com\nOffice hours'), 'support-support-example-com');
  assert.equal(suggestBlockName('Dirección de la oficina central y más'), 'dirección-de-la-oficina');
  assert.equal(suggestBlockName('***'), 'block');
});

test('wrapAsBlock puts the markers on lines of their own', () => {
  assert.equal(wrapAsBlock('', 'Hello\nWorld', '', 'greet'), '==share:greet==\nHello\nWorld\n==/share==');
  assert.equal(wrapAsBlock('Intro ', 'Hello', ' outro', 'g'), '\n==share:g==\nHello\n==/share==\n');
  assert.equal(wrapAsBlock('Intro\n', 'Hello\n', '\nNext', 'g'), '==share:g==\nHello\n==/share==');
});

test('refLines finds references on lines of their own', () => {
  const lines = [
    '---',
    'x: ==ref:A^b==',
    '---',
    '==ref:Note^intro==',
    '  ==ref:Other note^signature==  ',
    'Text ==ref:A^inline== text',
    '```',
    '==ref:A^code==',
    '```',
    '==ref:Folder/Note^é-1==',
  ];
  assert.deepEqual(refLines(lines), [
    { line: 3, noteName: 'Note', blockName: 'intro', values: new Map() },
    { line: 4, noteName: 'Other note', blockName: 'signature', values: new Map() },
    { line: 9, noteName: 'Folder/Note', blockName: 'é-1', values: new Map() },
  ]);
});

test('definitionLine finds the share marker', () => {
  assert.equal(definitionLine('a\r\n==share:x==\r\nbody\r\n==/share==', 'x'), 1);
  assert.equal(definitionLine('==share:xy==\nb\n==/share==', 'x'), -1);
});

// ── Fill-in values ───────────────────────────────────────────────────────

const vals = (text: string) => [...parseRefValues(text)];

test('parseRef reads values after the block name', () => {
  const ref = parseRef('ref:Mi nota^greeting name=Ana role="team lead"');

  assert.equal(ref?.noteName, 'Mi nota');
  assert.equal(ref?.blockName, 'greeting');
  assert.deepEqual([...(ref?.values ?? [])], [['name', 'Ana'], ['role', 'team lead']]);
});

test('parseRef on a plain reference has no values', () => {
  assert.equal(parseRef('ref:Nota^bloque')?.values.size, 0);
});

test('parseRefValues reads words, quoted strings and accented keys', () => {
  assert.deepEqual(vals('a=1 b="two words" año=sí'), [['a', '1'], ['b', 'two words'], ['año', 'sí']]);
});

test('parseRefValues reads escaped quotes and backslashes', () => {
  assert.deepEqual(vals('q="she said \\"hi\\" to me" p="C:\\\\dir"'), [
    ['q', 'she said "hi" to me'],
    ['p', 'C:\\dir'],
  ]);
});

test('parseRefValues still reads a quote whose backslash the renderer ate', () => {
  assert.deepEqual(vals('q="say "hi"! ok" r=2'), [['q', 'say "hi"! ok'], ['r', '2']]);
});

test('parseRefValues ignores what is not key=value', () => {
  assert.deepEqual(vals('stray =x "loose" a=1 ==b'), [['a', '1']]);
});

test('parseRefValues lets the last duplicate key win', () => {
  assert.deepEqual(vals('a=1 a=2'), [['a', '2']]);
});

test('parseRefValues treats an empty value as not given', () => {
  assert.deepEqual(vals('a=1 a=""'), []);
  assert.deepEqual(vals('a="" b=2'), [['b', '2']]);
});

test('parseRefValues survives an unterminated quote', () => {
  assert.deepEqual(vals('a="open b=2'), [['a', 'open b=2']]);
});

test('formatRefValue output is read back unchanged', () => {
  for (const value of ['Ana', 'team lead', 'say "hi"', 'back\\slash', 'a=b', ' pad ']) {
    assert.deepEqual(vals(`k=${formatRefValue(value)}`), [['k', value]], value);
  }
});

test('fillPlaceholders fills values and defaults', () => {
  const body = 'Hi {{name}}, you are {{ role | guest }} on {{team|the team}}.';
  const out = fillPlaceholders(body, new Map([['name', 'Ana'], ['team', 'Core']]));

  assert.equal(out, 'Hi Ana, you are guest on Core.');
});

test('fillPlaceholders marks a missing value without a default', () => {
  assert.equal(
    fillPlaceholders('Hi {{name}}', new Map()),
    'Hi <span class="sb-missing" title="No value for name">{{name}}</span>',
  );
});

test('fillPlaceholders uses a given value over the default, and the same name everywhere', () => {
  assert.equal(fillPlaceholders('{{a|x}} {{a|y}} {{a}}', new Map([['a', '1']])), '1 1 1');
});

test('fillPlaceholders does not re-read braces inside a value', () => {
  assert.equal(fillPlaceholders('{{a}}', new Map([['a', '{{b}}']])), '{{b}}');
});

test('fillPlaceholders leaves code spans and fenced code untouched', () => {
  const body = 'Use `{{name}}` for {{name}}.\n```\n{{name}}\n```\n~~~md\n{{name}}\n~~~\n{{name}}';
  const out = fillPlaceholders(body, new Map([['name', 'Ana']]));

  assert.equal(out, 'Use `{{name}}` for Ana.\n```\n{{name}}\n```\n~~~md\n{{name}}\n~~~\nAna');
});

test('fillPlaceholders returns text without placeholders exactly as it was', () => {
  for (const body of ['Plain text', '{ single } and {{ }} and {{}}', 'a {{x y}} b', '']) {
    assert.equal(fillPlaceholders(body, new Map([['x', '1']])), body);
  }
});

test('blockPlaceholders lists names once, outside code', () => {
  const body = '{{b}} {{a|x}} {{b}} `{{c}}`\n```\n{{d}}\n```';

  assert.deepEqual(blockPlaceholders(body), ['b', 'a']);
  assert.deepEqual(blockPlaceholders('nothing here'), []);
});

test('valueStubs gives one empty value per placeholder, or nothing', () => {
  assert.equal(valueStubs('Hi {{name}} {{role|guest}}'), ' name="" role=""');
  assert.equal(valueStubs('No blanks'), '');
});

test('a reference with stubs parses with no values, so defaults apply', () => {
  const ref = parseRef('ref:N^b name="" role=""');

  assert.equal(ref?.values.size, 0);
});

test('retargetRefs keeps the values after the block name', () => {
  const rename = (name: string) => (name === 'Old' ? 'New' : null);
  const content = 'x ==ref:Old^g name=Ana role="team lead"== y ==ref:Old^h==\n==ref:Other^g a=1==';
  const result = retargetRefs(content, rename);

  assert.equal(result.count, 2);
  assert.equal(result.text, 'x ==ref:New^g name=Ana role="team lead"== y ==ref:New^h==\n==ref:Other^g a=1==');
});

test('retargetRefs does not mistake a highlight after a reference for its values', () => {
  const result = retargetRefs('==ref:Old^g== and ==marked==', (n) => (n === 'Old' ? 'New' : null));

  assert.equal(result.text, '==ref:New^g== and ==marked==');
});

test('rawRefTexts lists references outside code, with their values', () => {
  const content = '==ref:A^x n="a b"== `==ref:B^y==`\n```\n==ref:C^z==\n```\n==ref:D^w==';

  assert.deepEqual(rawRefTexts(content), ['ref:A^x n="a b"', 'ref:D^w']);
});

test('refLines reads values on a reference line', () => {
  const [found] = refLines(['==ref:Note^greeting name=Ana role="team lead"==']);

  assert.deepEqual([...found.values], [['name', 'Ana'], ['role', 'team lead']]);
});
