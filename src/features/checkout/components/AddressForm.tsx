import { Controller, type Control, type FieldErrors, type UseFormHandleSubmit } from 'react-hook-form';
import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { AppText, sizes, spacing } from '@/design-system';
import { useAppTheme } from '@/design-system/theme';

import type { AddressFormValues } from '../logic/address-schema';
import { buildValidationSummary } from '../logic/validation-summary';

type AddressFormProps = Readonly<{
  control: Control<AddressFormValues>;
  errors: FieldErrors<AddressFormValues>;
  handleSubmit: UseFormHandleSubmit<AddressFormValues>;
  onSubmit: (values: AddressFormValues) => void;
}>;

const fields: readonly Readonly<{ name: keyof AddressFormValues; label: string; keyboardType?: 'phone-pad' | 'number-pad' }>[] = [
  { name: 'fullName', label: 'fullName' },
  { name: 'phone', label: 'phone', keyboardType: 'phone-pad' },
  { name: 'postalCode', label: 'postalCode', keyboardType: 'number-pad' },
  { name: 'state', label: 'state' },
  { name: 'city', label: 'city' },
  { name: 'street', label: 'street' },
  { name: 'exteriorNumber', label: 'exteriorNumber' },
  { name: 'interiorNumber', label: 'interiorNumber' },
];

export function AddressForm({ control, errors, handleSubmit, onSubmit }: AddressFormProps) {
  const { t } = useTranslation();
  const { colors, scheme } = useAppTheme();
  const errorMessages = fields.map(({ name }) => errors[name]?.message).filter((message): message is string => typeof message === 'string');
  const summaryText = buildValidationSummary(t('checkout.validationSummary', { count: errorMessages.length }), errorMessages.map((message) => t(message)));

  // iOS does not consistently expose a newly inserted accessible View with a
  // nested Text. Announcing the same label also makes the update deterministic
  // for VoiceOver, while the Text below remains in the AX tree for navigation.
  useEffect(() => {
    if (errorMessages.length > 0) void AccessibilityInfo.announceForAccessibility(summaryText);
  }, [errorMessages.length, summaryText]);

  return (
    <View style={styles.form}>
      {errorMessages.length > 0 && (
        <View style={[styles.summary, { borderColor: colors.error }]}>
          <AppText accessible accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={summaryText} variant="label">{summaryText}</AppText>
        </View>
      )}
      {fields.map(({ name, label, keyboardType }) => (
        <Controller
          key={name}
          control={control}
          name={name}
          render={({ field, fieldState }) => {
            const error = fieldState.error?.message;
            const inputId = `checkout-${name}`;
            return (
              <View style={styles.field}>
                {/* H-N5: the TextInput already speaks this text (accessibilityLabel). `aria-hidden` keeps the label
                    on screen for sighted users but out of the accessibility tree, so it is not a second stop that
                    repeats the field name. RN maps it to `accessibilityElementsHidden` (iOS) and
                    `importantForAccessibility="no-hide-descendants"` (Android). */}
                <AppText aria-hidden nativeID={`${inputId}-label`} variant="label">{t(`checkout.fields.${label}`)}</AppText>
                <TextInput
                  accessibilityLabel={t(`checkout.fields.${label}`)}
                  accessibilityHint={t(`checkout.hints.${label}`)}
                  aria-errormessage={error ? `${inputId}-error` : undefined}
                  aria-labelledby={`${inputId}-label`}
                  autoCapitalize={name === 'fullName' || name === 'city' || name === 'state' ? 'words' : 'none'}
                  // The keyboard follows the theme the user chose (it can differ from the system's).
                  keyboardAppearance={scheme === 'dark' ? 'dark' : 'light'}
                  keyboardType={keyboardType}
                  onBlur={field.onBlur}
                  onChangeText={field.onChange}
                  placeholder={t(`checkout.placeholders.${label}`)}
                  ref={field.ref}
                  style={[styles.input, { borderColor: error ? colors.error : colors.controlBorder, color: colors.text }]}
                  testID={inputId}
                  value={field.value ?? ''}
                />
                {error && <AppText accessibilityLiveRegion="polite" nativeID={`${inputId}-error`} style={{ color: colors.error }}>{t(error)}</AppText>}
              </View>
            );
          }}
        />
      ))}
      <Pressable accessibilityRole="button" accessibilityLabel={t('checkout.submit')} accessibilityHint={t('checkout.submitHint')} onPress={() => void handleSubmit(onSubmit)()} style={[styles.submit, { backgroundColor: colors.primary }]}>
        <AppText tone="onPrimary" variant="label">{t('checkout.submit')}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingBottom: spacing.xl },
  field: { gap: spacing.xs },
  input: { minHeight: sizes.minimumTouchTarget, borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.md, fontSize: 16 },
  summary: { borderWidth: 1, borderRadius: 8, padding: spacing.md },
  submit: { minHeight: sizes.minimumTouchTarget, borderRadius: 999, alignItems: 'center', justifyContent: 'center', padding: spacing.md },
});
