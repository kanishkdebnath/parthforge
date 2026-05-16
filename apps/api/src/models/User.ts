import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    avatarUrl: { type: String },
    googleId: { type: String, index: true, sparse: true },
  },
  { timestamps: true }
);

// InferSchemaType does NOT include timestamps even when `timestamps: true` is set,
// so declare them explicitly so consumers (auth plugin, /me route) can read them
// as typed `Date` values.
export type UserDoc = InferSchemaType<typeof userSchema> & {
  _id: string;
  createdAt: Date;
  updatedAt: Date;
};

export const UserModel = model('User', userSchema);
