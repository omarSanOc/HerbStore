import { z } from 'zod';

const trimmed = (message: string, minimum: number) =>
  z.string().trim().min(minimum, message);

const optionalTrimmed = z.string().trim().transform((value) => (value === '' ? undefined : value)).optional();

/** Volatile checkout form contract. Messages are resource keys, never user-facing copy. */
export const addressSchema = z.object({
  fullName: trimmed('checkout.validation.fullName.min', 3),
  phone: z.string().trim().regex(/^\d{10}$/, 'checkout.validation.phone.format'),
  postalCode: z.string().trim().regex(/^\d{5}$/, 'checkout.validation.postalCode.format'),
  state: trimmed('checkout.validation.state.min', 2),
  city: trimmed('checkout.validation.city.min', 2),
  street: trimmed('checkout.validation.street.min', 3),
  exteriorNumber: trimmed('checkout.validation.exteriorNumber.required', 1),
  interiorNumber: optionalTrimmed,
});

export type AddressFormValues = z.infer<typeof addressSchema>;
