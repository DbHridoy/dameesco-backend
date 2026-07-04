import slugifyLib from 'slugify';

export const slugify = (text: string): string => {
  return slugifyLib(text, {
    lower: true,
    strict: true,
    trim: true,
  });
};

export const slugifyWithRandomSuffix = (text: string): string => {
  const base = slugify(text);
  const random = Math.random().toString(36).substring(2, 8);
  return `${base}-${random}`;
};