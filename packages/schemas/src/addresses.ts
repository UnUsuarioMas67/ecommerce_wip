import { z } from 'zod';
import { UserIdSchema } from './users';

export const AddressIdSchema = z.uuid();
export type AddressId = z.infer<typeof AddressIdSchema>;

const RecipientSchema = z.string().min(1).max(100);
const LineSchema = z.string().min(1).max(200);
const OptionalLineSchema = z.string().max(200).optional();
const CitySchema = z.string().min(1).max(100);
const RegionSchema = z.string().min(1).max(100);
const PostalCodeSchema = z.string().min(1).max(20);
const CountryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'Country must be an ISO-3166 alpha-2 code');

export const AddressSnapshotSchema = z.strictObject({
  recipient: RecipientSchema,
  line1: LineSchema,
  line2: OptionalLineSchema,
  city: CitySchema,
  region: RegionSchema,
  postalCode: PostalCodeSchema,
  country: CountryCodeSchema,
  phoneNumber: z.e164().optional(),
});
export type AddressSnapshot = z.infer<typeof AddressSnapshotSchema>;

export const AddressSchema = z.strictObject({
  id: AddressIdSchema,
  userId: UserIdSchema,
  label: z.string().min(1).max(50).default('Default'),
  recipient: RecipientSchema,
  line1: LineSchema,
  line2: OptionalLineSchema,
  city: CitySchema,
  region: RegionSchema,
  postalCode: PostalCodeSchema,
  country: CountryCodeSchema,
  phoneNumber: z.e164().optional(),
  isDefault: z.boolean().default(false),
  createdAt: z.iso.datetime(),
  lastUpdated: z.iso.datetime(),
});
export type Address = z.infer<typeof AddressSchema>;

export const CreateAddressSchema = z.strictObject({
  userId: UserIdSchema,
  label: z.string().min(1).max(50).default('Default'),
  recipient: RecipientSchema,
  line1: LineSchema,
  line2: OptionalLineSchema,
  city: CitySchema,
  region: RegionSchema,
  postalCode: PostalCodeSchema,
  country: CountryCodeSchema,
  phoneNumber: z.e164().optional(),
  isDefault: z.boolean().default(false),
});
export type CreateAddressInput = z.infer<typeof CreateAddressSchema>;

export const UpdateAddressSchema = z
  .strictObject({
    label: z.string().min(1).max(50),
    recipient: RecipientSchema,
    line1: LineSchema,
    line2: OptionalLineSchema,
    city: CitySchema,
    region: RegionSchema,
    postalCode: PostalCodeSchema,
    country: CountryCodeSchema,
    phoneNumber: z.e164().optional(),
    isDefault: z.boolean(),
  })
  .partial()
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });
export type UpdateAddressInput = z.infer<typeof UpdateAddressSchema>;