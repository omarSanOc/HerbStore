import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { AccessibilityInfo, Keyboard, StyleSheet, View, type TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

import { useAppDispatch, useAppSelector } from '@/core/store/hooks';
import { AppSurface, AppText, fontScaleLimits, spacing } from '@/design-system';
import { ProductListView } from '@/features/product/list/ProductListView';
import { normalizeSearchText } from '@/features/product/logic/product-query';

import { SearchField } from '../components/SearchField';
import { SearchHistoryList } from '../components/SearchHistoryList';
import { useDebouncedValue } from '../hooks/use-debounced-value';
import { resolveSearchView, resolveSubmittedText } from '../logic/search-view';
import {
  historyCleared,
  searchRemoved,
  searchSent,
  selectSearchHistory,
} from '../store/search-history-slice';

/**
 * The search screen: a text field, the recent searches while the field is empty and the product
 * list (`ProductListView`) for the text that settled.
 *
 * Three pieces of state, each with ONE owner:
 * - `text`: what the field holds (local `useState`, changes on every key).
 * - `debounced`: `text` after 400 ms of stillness (`useDebouncedValue`), or at once when the
 *   search is sent. Together with `text` it decides the view (`resolveSearchView`, pure).
 * - the history: Redux (`searchHistory`), because it outlives this screen and Day 4 persists it.
 *
 * Results of an old text never show up: while the view is `pending` the list is PAUSED (no query,
 * skeleton) and, once it queries, `useProductList` reads `currentData` of the entry of the CURRENT
 * text. RTK Query keeps one cache entry per normalized text, so a late response to "vit" is stored
 * under "vit" and can never replace the list of "vitam".
 *
 * `ProductListView` stays mounted from the first character until the field is emptied, so the quick
 * filters, the advanced ones and the sort survive editing the text; emptying the field (or the
 * "clear" action of the empty state) unmounts it, and the next search starts with none.
 *
 * What counts as "sending a search" (RF-17): the keyboard's search key, running a history entry or
 * tapping a result. Typing alone never writes the history (a half-typed "vit" is not a search).
 * The search key sends the text of the submit EVENT, never the one of the last render (S-2).
 *
 * Keyboard rule (S-3): every action that EXECUTES a search closes the keyboard (the search key,
 * running a history entry), because the user now wants to read results; every action that EMPTIES
 * the field ("Borrar texto", "Limpiar búsqueda") leaves the field focused WITH the keyboard up,
 * because the user now wants to type again. `focusFieldWithKeyboard` implements the second half.
 *
 * Compose: a `ViewModel` with `query: MutableStateFlow<String>`, `query.debounce(400)
 * .distinctUntilChanged().flatMapLatest { repo.search(it) }`; SwiftUI: `@State var text` with
 * `.task(id: text) { try await Task.sleep(for: .milliseconds(400)); ... }`, whose task is cancelled
 * when `text` changes.
 */
export function SearchScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const dispatch = useAppDispatch();
  const history = useAppSelector(selectSearchHistory);
  const inputRef = useRef<TextInput>(null);

  const [text, setText] = useState('');
  const [debounced, settleNow] = useDebouncedValue(text);
  const view = resolveSearchView({ rawText: text, debouncedText: debounced });
  const visibleText = text.trim();

  /** Sends a search: it enters the history, the list queries without waiting and the keyboard closes. */
  const sendSearch = (sent: string) => {
    if (normalizeSearchText(sent) === '') {
      return;
    }
    dispatch(searchSent(sent));
    settleNow(sent);
    // A no-op for the search key (it already closed it); this is what makes "run an entry" match.
    Keyboard.dismiss();
  };

  /**
   * Gives the field the focus AND makes sure the keyboard is up. `focus()` alone is not enough once
   * the keyboard was closed with the field still focused (Android keeps the focus after the search
   * key): React Native ignores `focus()` on the input it believes is focused, so the keyboard stays
   * hidden. `blur()` first drops that belief; it is skipped while the keyboard is visible so it
   * never makes the keyboard flicker.
   */
  const focusFieldWithKeyboard = () => {
    const input = inputRef.current;
    if (input === null) {
      return;
    }
    if (!Keyboard.isVisible()) {
      input.blur();
    }
    input.focus();
  };

  const runEntry = (entry: string) => {
    setText(entry);
    sendSearch(entry);
  };

  const clearText = () => {
    setText('');
    settleNow('');
    focusFieldWithKeyboard();
  };

  const removeEntry = (entry: string) => {
    dispatch(searchRemoved(entry));
    AccessibilityInfo.announceForAccessibility(t('search.history.removed', { text: entry }));
  };

  const clearHistory = () => {
    dispatch(historyCleared());
    AccessibilityInfo.announceForAccessibility(t('search.history.cleared'));
  };

  return (
    <AppSurface level="page" style={styles.page}>
      <View style={styles.fieldRow}>
        <SearchField
          ref={inputRef}
          onChangeText={setText}
          onClear={clearText}
          onSubmit={(submitted) => sendSearch(resolveSubmittedText(submitted, text))}
          value={text}
        />
      </View>
      {view.kind === 'history' ? (
        <SearchHistoryList
          entries={history}
          onClear={clearHistory}
          onRemove={removeEntry}
          onSelect={runEntry}
        />
      ) : (
        <ProductListView
          emptyAction={{
            label: t('search.empty.clear'),
            hint: t('search.empty.clearHint'),
            onPress: clearText,
          }}
          emptyCopy={{
            title: t('search.empty.title', { query: visibleText }),
            message: t('search.empty.message'),
          }}
          // With filters on, ONE action clears the text and the filters (plan, RF-19): leaving the
          // `history` view unmounts the list and its filters with it.
          emptyFilteredAction={{
            label: t('search.empty.clearAll'),
            hint: t('search.empty.clearAllHint'),
            onPress: clearText,
          }}
          emptyFilteredCopy={{
            title: t('search.empty.filteredTitle', { query: visibleText }),
            message: t('search.empty.filteredMessage'),
          }}
          header={
            <AppText
              accessibilityRole="header"
              maxFontSizeMultiplier={fontScaleLimits.listTitle}
              variant="subheading">
              {t('search.results.title', { query: visibleText })}
            </AppText>
          }
          onOpenProduct={(id) => {
            // Tapping a result also counts as having searched for that text (RF-17).
            dispatch(searchSent(text));
            router.push({ pathname: '/product/[id]', params: { id } });
          }}
          paused={view.kind === 'pending'}
          scope={{ search: debounced }}
        />
      )}
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  fieldRow: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
});
