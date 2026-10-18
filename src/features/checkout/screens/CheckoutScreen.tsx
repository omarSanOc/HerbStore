import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import { useAppDispatch, useAppSelector } from '@/core/store/hooks';
import { AppSurface, AppText, spacing } from '@/design-system';
import { selectCanCheckout } from '@/features/cart/logic/cart-selectors';
import type { StockAdjustment } from '@/features/cart/logic/cart';
import { submitOrder } from '../store/checkout-thunks';

import { AddressForm } from '../components/AddressForm';
import { CheckoutNotice } from '../components/CheckoutNotice';
import { addressSchema, type AddressFormValues } from '../logic/address-schema';
import { ADDRESS_FIELD_NAMES, hasGeneralServerError, mapServerFieldErrors } from '../logic/field-errors';

/** What the form cannot place under a field. Stored as data and translated when drawn (language can change). */
type Notice = Readonly<{ kind: 'general' } | { kind: 'out-of-stock'; adjustments: readonly StockAdjustment[] }>;

const CART_HREF = '/(tabs)/(cart)/cart';

const defaults: AddressFormValues = { fullName: '', phone: '', postalCode: '', state: '', city: '', street: '', exteriorNumber: '', interiorNumber: undefined };

/** Address is intentionally held only by RHF's in-memory form state (RNF-1). */
export function CheckoutScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const canCheckout = useAppSelector(selectCanCheckout);
  const dispatch = useAppDispatch();
  const form = useForm<AddressFormValues>({ defaultValues: defaults, mode: 'onSubmit', resolver: zodResolver(addressSchema) });
  const [notice, setNotice] = useState<Notice | null>(null);
  // `sending` is what the screen draws; the ref is the lock that closes a second tap synchronously
  // (state would still read `false` inside a second handler call made before the next render).
  const [sending, setSending] = useState(false);
  const sendingLock = useRef(false);

  // Sending an order locks the cart (the attempt is `preliminary`, then `unresolved` or, once the
  // order is confirmed, the cart is cleared): in all those cases `canCheckout` turns false BECAUSE
  // of this screen's own submit, and sending the user to the cart would race the navigation that
  // the outcome decides below (confirmation / status). Only a cart that is unusable while the user
  // is NOT sending sends them back (a deep link with an empty cart). An out-of-stock refresh that
  // emptied the cart is the exception: the notice with the adjusted/removed lines IS the
  // explanation, so the screen stays to show it instead of bouncing to an empty cart that says
  // nothing (spec 006, T3b fix). Back navigation still returns to the cart.
  const outOfStockNotice = notice?.kind === 'out-of-stock';
  useEffect(() => {
    if (!canCheckout && !sending && !outOfStockNotice) router.replace(CART_HREF);
  }, [canCheckout, sending, outOfStockNotice, router]);

  if (!canCheckout && !sending && !outOfStockNotice) return null;

  const showNotice = (next: Notice, spoken: string) => {
    setNotice(next);
    void AccessibilityInfo.announceForAccessibility(spoken);
  };

  const onSubmit = async (values: AddressFormValues) => {
    if (sendingLock.current) return;
    sendingLock.current = true;
    setSending(true);
    setNotice(null);
    // Once the outcome sends the user to another screen the lock stays closed: a late tap on this
    // form must not start a second order while the navigation settles.
    let leaving = false;
    try {
      const result = await dispatch(submitOrder({ shippingAddress: values })).unwrap();
      if ('ignored' in result) return;
      if (result.outcome === 'confirmed') {
        leaving = true;
        router.replace('/(tabs)/(cart)/order-confirmation');
      } else if (result.outcome === 'validation') {
        const mapped = mapServerFieldErrors(result.fields);
        // Under the field the server names; the form's own summary announces them (AddressForm).
        for (const name of ADDRESS_FIELD_NAMES) {
          const message = mapped.fields[name];
          if (message !== undefined) form.setError(name, { type: 'server', message });
        }
        if (hasGeneralServerError(mapped)) showNotice({ kind: 'general' }, t('checkout.server.genericError'));
      } else if (result.outcome === 'outOfStock') {
        showNotice({ kind: 'out-of-stock', adjustments: result.adjustments }, [t('checkout.outOfStock.message'), ...result.adjustments.map((adjustment) => describeAdjustment(t, adjustment))].join(' '));
      } else {
        leaving = true;
        router.replace('/(tabs)/(cart)/order-status');
      }
    } finally {
      if (!leaving) {
        sendingLock.current = false;
        setSending(false);
      }
    }
  };

  return (
    <AppSurface level="page" style={styles.page}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" contentInsetAdjustmentBehavior="automatic">
          <AppText accessibilityRole="header" variant="subheading">{t('checkout.title')}</AppText>
          <AppText tone="muted">{t('checkout.description')}</AppText>
          {notice === null ? null : notice.kind === 'general' ? (
            <CheckoutNotice message={t('checkout.server.genericError')} />
          ) : (
            <CheckoutNotice message={t('checkout.outOfStock.message')} details={notice.adjustments.map((adjustment) => describeAdjustment(t, adjustment))} />
          )}
          <AddressForm control={form.control} errors={form.formState.errors} handleSubmit={form.handleSubmit} onSubmit={onSubmit} />
        </ScrollView>
      </KeyboardAvoidingView>
    </AppSurface>
  );
}

function describeAdjustment(t: TFunction, adjustment: StockAdjustment): string {
  return adjustment.removed
    ? t('checkout.outOfStock.removed', { name: adjustment.name })
    : t('checkout.outOfStock.adjusted', { name: adjustment.name, quantity: adjustment.quantity, previous: adjustment.previousQuantity });
}

const styles = StyleSheet.create({ page: { flex: 1 }, flex: { flex: 1 }, content: { gap: spacing.md, padding: spacing.md, paddingBottom: spacing.xl } });
