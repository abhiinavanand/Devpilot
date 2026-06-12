export const toIsoDate = (value) => new Date(value).toISOString();

export const addDays = (value, days) => {
  const date = new Date(value);
  date.setDate(date.getDate() + days);
  return date;
};
