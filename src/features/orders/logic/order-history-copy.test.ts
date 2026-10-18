/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

import { en } from '../../../core/i18n/resources/en.ts';
import { es } from '../../../core/i18n/resources/es.ts';

// RF-11: "My orders" shows only what this installation confirmed and NEVER promises sync or recovery
// from outside (the history lives on this device; there is no account or endpoint behind it). The
// words are checked in the resources, in both languages, so a future edit cannot add the promise.
const PROMISES = /sincroniz|synchroni[sz]|\bsync\b|\bnube\b|cloud|recuper|restor|respald|backup|otro dispositivo|other device|todos tus pedidos|all your orders/i;

function texts(node: unknown): string[] {
  return typeof node === 'string' ? [node] : Object.values(node as Record<string, unknown>).flatMap(texts);
}

for (const [language, { translation }] of [['es', es], ['en', en]] as const) {
  test(`${language}: no text of "My orders" or its entry in Account promises sync, backup or recovery`, () => {
    const own = [
      ...texts(translation.orders),
      translation.placeholders.account.openOrders,
      translation.placeholders.account.openOrdersHint,
    ];
    assert.ok(own.length >= 10);
    for (const text of own) assert.doesNotMatch(text, PROMISES, text);
  });

  test(`${language}: the scope of the list is stated ("this installation"), and no text mentions an address`, () => {
    assert.match(translation.orders.intro, language === 'es' ? /esta instalación/ : /this installation/);
    assert.match(translation.orders.empty.message, language === 'es' ? /esta instalación/ : /this installation/);
    for (const text of texts(translation.orders)) assert.doesNotMatch(text, /direcci[oó]n|address/i, text);
  });
}
