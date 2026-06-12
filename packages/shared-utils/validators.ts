export const isEmail = (value) => /\S+@\S+\.\S+/.test(value);

export const isNonEmpty = (value) => typeof value === 'string' && value.trim().length > 0;
