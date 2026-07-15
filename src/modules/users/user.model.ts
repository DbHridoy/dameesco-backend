import mongoose, { Schema, Document, Model } from 'mongoose';
import { USER_ROLES, UserRole } from '@/constants/roles';
import { USER_STATUS, UserStatus } from '@/constants/user-status';
import {
  SUBSCRIPTION_STATUS,
  SUBSCRIPTION_PLAN,
  SubscriptionStatus,
  SubscriptionPlan,
} from '@/constants/subscription';

export interface UserDocument extends Document {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  address?: string;
  status: UserStatus;
  emailVerified: boolean;
  subscriptionStatus: SubscriptionStatus;
  subscriptionPlan: SubscriptionPlan;
  paidAccessStartsAt?: Date | null;
  paidAccessEndsAt?: Date | null;
  downloadLimit: number;
  downloadsUsed: number;
  passwordResetOtp?: string | null;
  passwordResetOtpExpiresAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserModel extends Model<UserDocument> {
  findByEmail(email: string): Promise<UserDocument | null>;
}

const userSchema = new Schema<UserDocument, UserModel>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
      minlength: 8,
    },
    role: {
      type: String,
      enum: Object.values(USER_ROLES),
      default: USER_ROLES.USER,
      required: true,
    },
    avatar: { type: String },
    phone: { type: String, trim: true },
    address: { type: String, trim: true, maxlength: 500 },
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.ACTIVE,
    },
    emailVerified: { type: Boolean, default: false },
    subscriptionStatus: {
      type: String,
      enum: Object.values(SUBSCRIPTION_STATUS),
      default: SUBSCRIPTION_STATUS.FREE,
    },
    subscriptionPlan: {
      type: String,
      enum: Object.values(SUBSCRIPTION_PLAN),
      default: SUBSCRIPTION_PLAN.FREE,
    },
    paidAccessStartsAt: { type: Date, default: null },
    paidAccessEndsAt: { type: Date, default: null },
    downloadLimit: { type: Number, default: 5 },
    downloadsUsed: { type: Number, default: 0 },
    passwordResetOtp: { type: String, default: null, select: false },
    passwordResetOtpExpiresAt: { type: Date, default: null, select: false },
  },
  { timestamps: true },
);

userSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject({ versionKey: false });
  delete obj.password;
  delete obj.passwordResetOtp;
  delete obj.passwordResetOtpExpiresAt;
  return obj;
};

const User = mongoose.model<UserDocument, UserModel>('User', userSchema);

export default User;
