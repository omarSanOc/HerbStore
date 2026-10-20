/// <reference types="node" />
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  HOME_TAB_ROUTE,
  planHomeRoot,
  planHomeRootFromRoot,
  type HomeRootAction,
  type RootStateLike,
  type TabsStateLike,
} from './home-root-plan.ts';

const TABS_KEY = 'tabs-key';
const HOME_STACK_KEY = 'home-stack-key';

type StackLike = NonNullable<TabsStateLike['routes'][number]['state']>;

/** Tabs state with the Cart tab focused, as the empty cart sees it. */
function tabsWith(home: TabsStateLike['routes'][number]): TabsStateLike {
  return {
    key: TABS_KEY,
    routes: [home, { name: '(cart)', state: { key: 'cart-stack', routes: [{ name: 'cart' }] } }, { name: '(account)' }],
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

// ---------------------------------------------------------------------------------------------
// T4b: "Go to Home" from the unrecognized-link screen. `+not-found` lives in the ROOT Stack, above
// `(tabs)`, so the plan reads the root state, plans Home/Tabs first and pops the root stack last.
// ---------------------------------------------------------------------------------------------

const ROOT_KEY = 'root-key';
const popRootToTop: HomeRootAction = { type: 'POP_TO_TOP', target: ROOT_KEY };

/** Root Stack state as `useNavigation()` in `+not-found` reads it: `(tabs)` first, then the rest. */
function rootWith(tabs: TabsStateLike | undefined, ...above: string[]): RootStateLike {
  return {
    key: ROOT_KEY,
    routes: [{ name: '(tabs)', ...(tabs ? { state: tabs } : {}) }, ...above.map((name) => ({ name }))],
  };
}

const homeAtRoot = () => tabsWith({ name: HOME_TAB_ROUTE, state: homeStack('index') });
const homeWithProduct = () => tabsWith({ name: HOME_TAB_ROUTE, state: homeStack('index', 'product/[id]') });

/** Mirrors StackRouter `POP_TO_TOP` for both the Home stack and the root stack. */
function applyToRoot(root: RootStateLike, actions: readonly HomeRootAction[]): RootStateLike {
  return actions.reduce<RootStateLike>((current, action) => {
    if (action.type !== 'POP_TO_TOP') return current;
    if (action.target === current.key) return { ...current, routes: current.routes.slice(0, 1) };
    return {
      ...current,
      routes: current.routes.map((route) => (route.state ? { ...route, state: apply(route.state, [action]) } : route)),
    };
  }, root);
}

test('root: Home already at its root and the not-found screen on top -> select Home, then pop the root', () => {
  assert.deepEqual(planHomeRootFromRoot(rootWith(homeAtRoot(), '+not-found')), {
    actions: [jumpToHome, popRootToTop],
    needsReplace: false,
  });
});

test('root: Home with a product stacked under the not-found screen -> pop Home, select Home, pop the root (the reported bug)', () => {
  assert.deepEqual(planHomeRootFromRoot(rootWith(homeWithProduct(), '+not-found')), {
    actions: [popHomeToTop, jumpToHome, popRootToTop],
    needsReplace: false,
  });
});

test('root: another tab active (Cart) with Home stacked -> the same plan, the focused tab does not matter', () => {
  const tabs: TabsStateLike & { index: number } = { ...homeWithProduct(), index: 2 };
  assert.deepEqual(planHomeRootFromRoot(rootWith(tabs, '+not-found')).actions, [popHomeToTop, jumpToHome, popRootToTop]);
  const cartOnly: TabsStateLike & { index: number } = { ...homeAtRoot(), index: 2 };
  assert.deepEqual(planHomeRootFromRoot(rootWith(cartOnly, '+not-found')).actions, [jumpToHome, popRootToTop]);
});

test('root with only (tabs): no root step, nothing to pop', () => {
  assert.deepEqual(planHomeRootFromRoot(rootWith(homeAtRoot())), { actions: [jumpToHome], needsReplace: false });
  assert.deepEqual(planHomeRootFromRoot(rootWith(homeWithProduct())).actions, [popHomeToTop, jumpToHome]);
});

test('root: the scanner modal and the not-found screen above (tabs) are both closed by one root pop', () => {
  const plan = planHomeRootFromRoot(rootWith(homeWithProduct(), 'scanner', '+not-found'));
  assert.deepEqual(plan.actions, [popHomeToTop, jumpToHome, popRootToTop]);
});

test('root without (tabs): nothing to select, the caller must replace the route with "/"', () => {
  assert.deepEqual(planHomeRootFromRoot({ key: ROOT_KEY, routes: [{ name: '+not-found' }] }), { actions: [], needsReplace: true });
  assert.deepEqual(planHomeRootFromRoot({ key: ROOT_KEY, routes: [] }), { actions: [], needsReplace: true });
});

test('root with (tabs) not rendered yet (no nested state): only the root pop, when there is something above', () => {
  assert.deepEqual(planHomeRootFromRoot(rootWith(undefined, '+not-found')), { actions: [popRootToTop], needsReplace: false });
  assert.deepEqual(planHomeRootFromRoot(rootWith(undefined)), { actions: [], needsReplace: false });
});

test('no root state at all: the caller must replace the route with "/"', () => {
  assert.deepEqual(planHomeRootFromRoot(undefined), { actions: [], needsReplace: true });
});

test('root plan order: Home and Tabs while still hidden, the root pop is always LAST and targets the root key', () => {
  const { actions } = planHomeRootFromRoot(rootWith(homeWithProduct(), '+not-found'));
  assert.equal(actions.at(-1)?.target, ROOT_KEY);
  assert.deepEqual(actions.slice(0, -1).map((action) => action.target), [HOME_STACK_KEY, TABS_KEY]);
});

test('root plan: every action is targeted at a navigator key and none creates instances (no "not handled" warning)', () => {
  const states = [
    rootWith(homeAtRoot(), '+not-found'),
    rootWith(homeWithProduct(), '+not-found'),
    rootWith(homeWithProduct(), 'scanner', '+not-found'),
    rootWith(undefined, '+not-found'),
  ];
  for (const state of states) {
    for (const action of planHomeRootFromRoot(state).actions) {
      assert.equal(typeof action.target, 'string', JSON.stringify(action));
      assert.equal(['POP_TO_TOP', 'JUMP_TO'].includes(action.type), true, action.type);
    }
  }
});

test('root plan: planning again after it ran only selects the tab (double tap stacks and pops nothing)', () => {
  const stacked = rootWith(homeWithProduct(), '+not-found');
  const after = applyToRoot(stacked, planHomeRootFromRoot(stacked).actions);

  assert.deepEqual(after.routes.map((route) => route.name), ['(tabs)']);
  assert.deepEqual(after.routes[0]?.state?.routes[0]?.state?.routes, [{ name: 'index' }]);
  assert.deepEqual(planHomeRootFromRoot(after), { actions: [jumpToHome], needsReplace: false });
});

test('root plan does not mutate the state it reads', () => {
  const stacked = rootWith(homeWithProduct(), '+not-found');
  const snapshot = JSON.stringify(stacked);
  planHomeRootFromRoot(stacked);
  assert.equal(JSON.stringify(stacked), snapshot);
});
