// Canonical copy: obsidian-dev/tools/i18n/i18n.test.ts, written to
// `tests/i18n.test.ts` by tools/i18n/rollout.mjs. Every locale must have exactly
// the English keys and the same {placeholders} in each message.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { LOCALES, catalogOf, detectLocale, format, getLocale, resolveLocale, setLocale, t } from '../src/i18n.ts';

const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('the locale files are exactly the supported languages', () => {
	const files = fs
		.readdirSync(new URL('../src/locales/', import.meta.url))
		.filter((f) => f.endsWith('.ts'))
		.map((f) => f.slice(0, -3))
		.sort();
	assert.deepEqual(files, [...LOCALES].sort());
});

const en = catalogOf('en');
for (const locale of LOCALES.filter((l) => l !== 'en')) {
	test(`${locale} has exactly the English keys`, () => {
		const have = catalogOf(locale);
		assert.deepEqual(
			Object.keys(have).sort(),
			Object.keys(en).sort(),
		);
	});

	test(`${locale} keeps the {placeholders} of every message and leaves none empty`, () => {
		const have = catalogOf(locale);
		for (const [key, text] of Object.entries(en)) {
			const translated = have[key as keyof typeof have];
			assert.ok(translated.trim(), `${locale}: ${key} is empty`);
			assert.deepEqual(placeholders(translated), placeholders(text), `${locale}: ${key}`);
			assert.equal(translated.includes('\n'), text.includes('\n'), `${locale}: ${key} line breaks`);
		}
	});
}

test('English messages are not blank', () => {
	for (const [key, text] of Object.entries(en)) assert.ok(text.trim(), key);
});

test('resolveLocale accepts our codes only, ignoring case', () => {
	assert.equal(resolveLocale('de'), 'de');
	assert.equal(resolveLocale('pt-BR'), 'pt-BR');
	assert.equal(resolveLocale('PT-br'), 'pt-BR');
	assert.equal(resolveLocale(' zh '), 'zh');
	for (const other of ['zh-TW', 'pt', 'en-GB', 'it', '', null, undefined]) assert.equal(resolveLocale(other), null);
});

test('detectLocale falls back to English and survives a failing lookup', () => {
	assert.equal(detectLocale(() => 'ja'), 'ja');
	assert.equal(detectLocale(() => 'xx'), 'en');
	assert.equal(detectLocale(() => { throw new Error('no storage'); }), 'en');
	assert.equal(detectLocale(), 'en'); // plain Node has no window
});

test('format replaces placeholders once and leaves unknown ones alone', () => {
	assert.equal(format('{a} and {b} and {c}', { a: 1, b: '{a}' }), '1 and {a} and {c}');
	assert.equal(format('no vars {a}'), 'no vars {a}');
});

test('t uses the current locale and falls back to English', () => {
	const key = Object.keys(en)[0] as keyof typeof en;
	try {
		for (const locale of LOCALES) {
			setLocale(locale);
			assert.equal(getLocale(), locale);
			assert.equal((t as (k: string) => string)(key), catalogOf(locale)[key] || en[key]);
		}
	} finally {
		setLocale('en');
	}
});
