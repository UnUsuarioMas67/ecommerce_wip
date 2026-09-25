import { z } from 'zod';

export const UserRoleSchema = z.enum(['client', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserIdSchema = z.uuid();
export type UserId = z.infer<typeof UserIdSchema>;

const PasswordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'At least one uppercase')
  .regex(/[a-z]/, 'At least one lowercase')
  .regex(/\d/, 'At least one number')
  .regex(/[^a-zA-Z\d]/, 'At least one special character')
  .max(64);

const BirthDateSchema = z
  .iso.date()
  .refine((date) => new Date(date).getTime() <= Date.now(), {
    message: 'birthDate cannot be in the future',
  });

const NameSchema = z.string().min(1).max(50);

export const UserSchema = z.strictObject({
  id: UserIdSchema,
  firstName: NameSchema,
  lastName: NameSchema,
  email: z.email(),
  passwordHash: z.string().min(1),
  phoneNumber: z.e164(),
  birthDate: BirthDateSchema,

  createdAt: z.iso.datetime(),
  lastUpdated: z.iso.datetime(),
});

export const CreateUserSchema = z
  .strictObject({
    ...UserSchema.pick({ firstName: true, lastName: true, email: true }).shape,
    password: PasswordSchema,
    confirmPassword: z.string(),
    phoneNumber: z.e164(),
    birthDate: BirthDateSchema,
  })
  .refine((val) => val.confirmPassword === val.password, {
    message: '"password" and "confirmPassword" must match',
    path: ['confirmPassword'],
  });

const UpdatePasswordSchema = z
  .strictObject({
    oldPassword: z.string(),
    newPassword: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((val) => val.confirmPassword === val.newPassword, {
    message: '"newPassword" and "confirmPassword" must match',
    path: ['confirmPassword'],
  });

export const UpdateUserSchema = z
  .strictObject({
    firstName: NameSchema,
    lastName: NameSchema,
    updatePassword: UpdatePasswordSchema,
    phoneNumber: z.e164(),
    birthDate: BirthDateSchema,
  })
  .partial()
  .refine((val) => Object.values(val).some((v) => v !== undefined), {
    message: 'At least one field must be provided',
  });