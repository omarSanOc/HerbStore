import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { useReducedMotionPreference } from '@/core/accessibility/use-reduced-motion';
import { useAppDispatch } from '@/core/store/hooks';
import { AppButton, AppSurface, AppText, sizes, spacing, useAppTheme } from '@/design-system';
import { languageChanged } from '@/features/preferences/store/preferences-slice';
import { ConceptCard } from '@/features/foundations/components/ConceptCard';
import {
  FlexLayoutDemo,
  type FlexDirectionOption,
} from '@/features/foundations/components/FlexLayoutDemo';
import { HookLifecycleDemo } from '@/features/foundations/components/HookLifecycleDemo';

type RenderErrorDemoModule = typeof import('@/features/foundations/components/RenderErrorDemo');
const RenderErrorDemo = __DEV__
  ? // eslint-disable-next-line @typescript-eslint/no-require-imports -- excludes the dev demo from release bundles
    (require('@/features/foundations/components/RenderErrorDemo') as RenderErrorDemoModule)
      .RenderErrorDemo
  : null;

export function FoundationScreen() {
  const reduceMotionEnabled = useReducedMotionPreference();
  const { i18n, t } = useTranslation();
  const dispatch = useAppDispatch();
  const { scheme } = useAppTheme();
  const scrollViewRef = useRef<ScrollView>(null);
  const [flexDirection, setFlexDirection] = useState<FlexDirectionOption>('row');
  const language = i18n.resolvedLanguage === 'en' ? 'en' : 'es';
  const themeLabel = scheme === 'dark' ? t('foundations.themeDark') : t('foundations.themeLight');
  const motionLabel = reduceMotionEnabled
    ? t('foundations.reducedMotionOn')
    : t('foundations.reducedMotionOff');

  return (
    <AppSurface level="page" style={styles.page}>
      {/* The stack header owns the top inset and the tab bar owns the bottom one. */}
      <SafeAreaView edges={['left', 'right']} style={styles.safeArea}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.content}
          contentInsetAdjustmentBehavior="automatic">
          <View style={styles.heading}>
            <AppText accessibilityRole="header" variant="heading">
              {t('foundations.title')}
            </AppText>
            <AppText tone="muted">{t('foundations.subtitle')}</AppText>
          </View>

          <ConceptCard title={t('foundations.languageHeading')}>
            <View style={styles.buttonRow}>
              <AppButton
                accessibilityHint={t('foundations.selectSpanishHint')}
                label={t('foundations.spanish')}
                onPress={() => dispatch(languageChanged('es'))}
                selected={language === 'es'}
              />
              <AppButton
                accessibilityHint={t('foundations.selectEnglishHint')}
                label={t('foundations.english')}
                onPress={() => dispatch(languageChanged('en'))}
                selected={language === 'en'}
              />
            </View>
          </ConceptCard>

          <ConceptCard title={t('foundations.systemPreferencesHeading')}>
            <AppText>{t('foundations.theme', { theme: themeLabel })}</AppText>
            <AppText>{t('foundations.reducedMotion', { setting: motionLabel })}</AppText>
            <AppText tone="muted">{t('foundations.accessibilityNote')}</AppText>
          </ConceptCard>

          <ConceptCard
            description={t('foundations.hooks.description')}
            title={t('foundations.hooks.heading')}>
            <HookLifecycleDemo />
          </ConceptCard>

          <ConceptCard
            description={t('foundations.layout.description')}
            title={t('foundations.layout.heading')}>
            <View style={styles.buttonRow}>
              <AppButton
                accessibilityHint={t('foundations.layout.rowHint')}
                label={t('foundations.layout.row')}
                onPress={() => setFlexDirection('row')}
                selected={flexDirection === 'row'}
              />
              <AppButton
                accessibilityHint={t('foundations.layout.columnHint')}
                label={t('foundations.layout.column')}
                onPress={() => setFlexDirection('column')}
                selected={flexDirection === 'column'}
              />
            </View>
            <FlexLayoutDemo direction={flexDirection} />
          </ConceptCard>

          <ConceptCard
            description={t('foundations.ref.description')}
            title={t('foundations.ref.heading')}>
            <View style={styles.buttonRow}>
              <AppButton
                accessibilityHint={t('foundations.ref.scrollToTopHint')}
                label={t('foundations.ref.scrollToTop')}
                onPress={() =>
                  scrollViewRef.current?.scrollTo({ y: 0, animated: !reduceMotionEnabled })
                }
              />
            </View>
          </ConceptCard>

          {RenderErrorDemo === null ? null : <RenderErrorDemo />}
        </ScrollView>
      </SafeAreaView>
    </AppSurface>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: sizes.contentMaxWidth,
    alignSelf: 'center',
    padding: spacing.lg,
    gap: spacing.lg,
  },
  heading: {
    gap: spacing.sm,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
});
