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
export type User = z.infer<typeof UserSchema>;

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
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

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
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const LoginSchema = z.strictObject({
  email: EmailSchema,
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const RefreshTokenSchema = z.strictObject({
  refreshToken: z.string().min(32).max(512),
});
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

export const AccessTokenClaimsSchema = z.strictObject({
  sub: UserIdSchema,
  role: UserRoleSchema,
  typ: z.literal('access'),
  ver: z.number().int().nonnegative(),
  jti: z.string().min(1),
  iss: z.string().min(1),
  aud: z.string().min(1),
  iat: z.number().int(),
  exp: z.number().int(),
});
export type AccessTokenClaims = z.infer<typeof AccessTokenClaimsSchema>;

export const TokenResponseSchema = z.strictObject({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number().int().positive(),
});
export type TokenResponse = z.infer<typeof TokenResponseSchema>;

export const AuthResponseSchema = z.strictObject({
  user: PublicUserSchema,
  ...TokenResponseSchema.shape,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
