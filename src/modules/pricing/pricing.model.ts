import mongoose, { Document, Model, Schema } from 'mongoose';

export interface PricingPlanDocument extends Document {
  key: 'starter' | 'studio';
  name: string;
  description: string;
  monthlyPrice: number;
  annualDiscountPercent: number;
  currency: string;
  cadence: string;
  ctaLabel: string;
  ctaHref: string;
  features: string[];
  isFeatured: boolean;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const pricingPlanSchema = new Schema<
  PricingPlanDocument,
  Model<PricingPlanDocument>
>(
  {
    key: {
      type: String,
      enum: ['starter', 'studio'],
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 400 },
    monthlyPrice: { type: Number, required: true, min: 0, default: 0 },
    annualDiscountPercent: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 0,
    },
    currency: { type: String, required: true, trim: true, default: 'USD' },
    cadence: { type: String, required: true, trim: true, default: 'seat / mo' },
    ctaLabel: { type: String, required: true, trim: true, maxlength: 80 },
    ctaHref: { type: String, required: true, trim: true, default: '/library' },
    features: { type: [String], default: [] },
    isFeatured: { type: Boolean, default: false },
    sortOrder: { type: Number, default: 0, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

const PricingPlan = mongoose.model<PricingPlanDocument>(
  'PricingPlan',
  pricingPlanSchema,
);

export default PricingPlan;
