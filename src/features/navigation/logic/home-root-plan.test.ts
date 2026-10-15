/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HOME_TAB_ROUTE,
  planHomeRoot,
  type HomeRootAction,
  type TabsStateLike,
} from './home-root-plan.ts';

const TABS_KEY = 'tabs-key';
const HOME_STACK_KEY = 'home-stack-key';

type StackLike = NonNullable<TabsStateLike['routes'][number]['state']>;

/** Tabs state with the Cart tab focused, as the empty cart sees it. */
function tabsWith(home: TabsStateLike['routes'][number]): TabsStateLike {
  return {
    key: TABS_KEY,
    routes: [home, { name: '(categories)' }, { name: '(cart)', state: { key: 'cart-stack', routes: [{ name: 'cart' }] } }, { name: '(account)' }],
  };
}

function homeStack(...names: string[]): StackLike {
  return { key: HOME_STACK_KEY, routes: names.map((name) => ({ name })) };
}

const jumpToHome: HomeRootAction = { type: 'JUMP_TO', payload: { name: HOME_TAB_ROUTE }, target: TABS_KEY };
const popHomeToTop: HomeRootAction = { type: 'POP_TO_TOP', target: HOME_STACK_KEY };

/**
 * Minimal reducer that mirrors what React Navigation does with each planned action (StackRouter
 * `POP_TO_TOP` keeps `routes[0]`; TabRouter `JUMP_TO` only changes the focused tab). It lets the test
 * check that planning again after the plan ran only selects the tab, so a double tap stacks nothing.
 */
function apply(state: TabsStateLike, actions: readonly HomeRootAction[]): TabsStateLike {
  return actions.reduce<TabsStateLike>((current, action) => {
    if (action.type !== 'POP_TO_TOP') return current;
    return {
      ...current,
      routes: current.routes.map((route) =>
        route.state?.key === action.target ? { ...route, state: { ...route.state, routes: route.state.routes.slice(0, 1) } } : route,
      ),
    };
  }, state);
}

test('Home already at its root: only selects the Home tab', () => {
  assert.deepEqual(planHomeRoot(tabsWith({ name: HOME_TAB_ROUTE, state: homeStack('index') })), [jumpToHome]);
});

test('Home with a product stacked: pops the Home stack to its root, then selects the tab', () => {
  assert.deepEqual(planHomeRoot(tabsWith({ name: HOME_TAB_ROUTE, state: homeStack('index', 'product/[id]') })), [popHomeToTop, jumpToHome]);
});

test('Home with category then product stacked: one targeted pop to top, then the tab', () => {
  assert.deepEqual(
    planHomeRoot(tabsWith({ name: HOME_TAB_ROUTE, state: homeStack('index', 'category/[id]', 'product/[id]') })),
    [popHomeToTop, jumpToHome],
  );
});

test('the pop is targeted at the Home stack key and the jump at the Tabs key, never untargeted', () => {
  const plan = planHomeRoot(tabsWith({ name: HOME_TAB_ROUTE, state: homeStack('index', 'search') }));
  assert.equal(plan[0]?.target, HOME_STACK_KEY);
  assert.equal(plan[1]?.target, TABS_KEY);
});

test('Home stack not created yet (no nested state): only selects the tab', () => {
  assert.deepEqual(planHomeRoot(tabsWith({ name: HOME_TAB_ROUTE })), [jumpToHome]);
});

test('Home stack state without a key cannot be targeted: only selects the tab', () => {
  const keyless = tabsWith({ name: HOME_TAB_ROUTE, state: { routes: [{ name: 'index' }, { name: 'product/[id]' }] } });
  assert.deepEqual(planHomeRoot(keyless), [jumpToHome]);
});

test('Home stack with no routes at all: only selects the tab', () => {
  assert.deepEqual(planHomeRoot(tabsWith({ name: HOME_TAB_ROUTE, state: { key: HOME_STACK_KEY, routes: [] } })), [jumpToHome]);
});

test('no Home tab in the state: plans nothing', () => {
  assert.deepEqual(planHomeRoot({ key: TABS_KEY, routes: [{ name: '(cart)' }, { name: '(account)' }] }), []);
});

test('no Tabs state at all: plans nothing', () => {
  assert.deepEqual(planHomeRoot(undefined), []);
});

test('never plans actions that create or search for instances (NAVIGATE, PUSH, POP_TO)', () => {
  const states = [
    tabsWith({ name: HOME_TAB_ROUTE }),
    tabsWith({ name: HOME_TAB_ROUTE, state: homeStack('index') }),
    tabsWith({ name: HOME_TAB_ROUTE, state: homeStack('index', 'product/[id]') }),
    tabsWith({ name: HOME_TAB_ROUTE, state: homeStack('index', 'category/[id]', 'product/[id]') }),
  ];
  for (const state of states) {
    const types = planHomeRoot(state).map((action) => action.type as string);
    for (const forbidden of ['NAVIGATE', 'PUSH', 'POP_TO', 'NAVIGATE_DEPRECATED', 'RESET']) {
      assert.equal(types.includes(forbidden), false, `${forbidden} in ${JSON.stringify(types)}`);
    }
  }
});

test('planning again after the plan ran only selects the tab (double tap stacks nothing)', () => {
  const stacked = tabsWith({ name: HOME_TAB_ROUTE, state: homeStack('index', 'category/[id]', 'product/[id]') });
  const after = apply(stacked, planHomeRoot(stacked));

  assert.deepEqual(after.routes[0]?.state?.routes, [{ name: 'index' }]);
  assert.deepEqual(planHomeRoot(after), [jumpToHome]);
});

test('does not mutate the state it reads', () => {
  const stacked = tabsWith({ name: HOME_TAB_ROUTE, state: homeStack('index', 'product/[id]') });
  const snapshot = JSON.stringify(stacked);
  planHomeRoot(stacked);
  assert.equal(JSON.stringify(stacked), snapshot);
});
