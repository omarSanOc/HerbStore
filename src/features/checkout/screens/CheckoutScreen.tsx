import { useEffect } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';

import { useAppDispatch, useAppSelector } from '@/core/store/hooks';
import { AppSurface, AppText, spacing } from '@/design-system';
import { selectCanCheckout } from '@/features/cart/logic/cart-selectors';
import { submitOrder } from '../store/checkout-thunks';

import { AddressForm } from '../components/AddressForm';
import { addressSchema, type AddressFormValues } from '../logic/address-schema';

const defaults: AddressFormValues = { fullName: '', phone: '', postalCode: '', state: '', city: '', street: '', exteriorNumber: '', interiorNumber: undefined };

/** Address is intentionally held only by RHF's in-memory form state (RNF-1). */
export function CheckoutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const canCheckout = useAppSelector(selectCanCheckout);
  const dispatch = useAppDispatch();
  const form = useForm<AddressFormValues>({ defaultValues: defaults, mode: 'onSubmit', resolver: zodResolver(addressSchema) });

  useEffect(() => {
    if (!canCheckout) router.replace('/(tabs)/(cart)/cart');
  }, [canCheckout, router]);

  if (!canCheckout) return null;

  const onSubmit = async (values: AddressFormValues) => {
    const result = await dispatch(submitOrder({ shippingAddress: values })).unwrap();
    if (result.outcome === 'confirmed') router.replace('/(tabs)/(cart)/order-confirmation');
    else if (result.outcome !== 'validation' && result.outcome !== 'outOfStock') router.replace('/(tabs)/(cart)/order-status');
  };

  return (
    <AppSurface level="page" style={styles.page}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
          <AppText accessibilityRole="header" variant="subheading">{t('checkout.title')}</AppText>
          <AppText tone="muted">{t('checkout.description')}</AppText>
          <AddressForm control={form.control} errors={form.formState.errors} handleSubmit={form.handleSubmit} onSubmit={onSubmit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </AppSurface>
  );
}

const styles = StyleSheet.create({ page: { flex: 1 }, flex: { flex: 1 }, content: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xl } });
