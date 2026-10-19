/*
 * Parsing the `date` string notes carry ("<weekday> DD/MM/YYYY, HH:mm"). No dependencies: the sync code uses it too.
 */

export const reverseDate = (dateFormatted: string): string => {
  const [, date, , time] = dateFormatted.split(" ");
  const [day, month, year] = date.split("/");
  return `${year}-${month}-${day}T${time}:00Z`;
};

export const getReversedDateTime = (dateFormatted: string): number => {
  return new Date(reverseDate(dateFormatted)).getTime();
};
