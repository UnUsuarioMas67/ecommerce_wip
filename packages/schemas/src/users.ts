import z from 'zod';

export const UserRoleSchema = z.enum(['client', 'admin']);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserIdSchema = z.uuid();
export type UserId = z.infer<typeof UserIdSchema>

const PasswordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Z]/, 'At least one uppercase')
  .regex(/[a-z]/, 'At least one lowercase')
  .regex(/\d/, 'At least one number')
  .regex(/[^a-zA-Z\d]/, 'At least one special character')
  .max(64);

export const UserSchema = z.object({
  id: UserIdSchema,
  firstName: z.string().nonempty().max(50),
  lastName: z.string().nonempty().max(50),
  email: z.email(),
  passwordHash: z.string(),
  phoneNumber: z.e164(),
  birthDate: z.iso.date(),

  createdAt: z.iso.datetime(),
  lastUpdated: z.iso.datetime(),
});

export const CreateUserSchema = z
  .strictObject({
    firstName: z.string().nonempty().max(50),
    lastName: z.string().nonempty().max(50),
    email: z.email(),
    password: PasswordSchema,
    confirmPassword: z.string(),
    phoneNumber: z.e164(),
    birthDate: z.iso.date(),
  })
  .refine((val) => val.confirmPassword === val.password, { error: '"password" and "confirmPassword" must match' });

const UpdatePasswordSchema = z
  .strictObject({
    oldPassword: z.string(),
    newPassword: PasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((val) => val.confirmPassword === val.newPassword, { error: '"newPassword" and "confirmPassword" must match' });

export const UpdateUserSchema = z
  .strictObject({
    firstName: z.string().nonempty().max(50),
    lastName: z.string().nonempty().max(50),
    updatePassword: UpdatePasswordSchema,
    phoneNumber: z.e164(),
    birthDate: z.iso.date(),
  })
  .partial();