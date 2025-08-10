import i18n from "i18next";

export const compareDates = (d1, d2) => {
  let date1 = new Date(d1).getTime();
  let date2 = new Date(d2).getTime();

  return date1 >= date2;
};

export const reverseDate = (dateFormatted) => {
  const [, date, , time] = dateFormatted.split(" ");

  const [day, month, year] = date.split("/");

  return `${year}-${month}-${day}T${time}:00Z`;
};

export const getReversedDateTime = (dateFormatted) => {
  return new Date(reverseDate(dateFormatted)).getTime();
};

export const formatDate = (date) => {
  const _date = new Date(date || new Date());

  const dayNames = [
    i18n.t("date.sun"),
    i18n.t("date.mon"),
    i18n.t("date.tue"),
    i18n.t("date.wed"),
    i18n.t("date.thu"),
    i18n.t("date.fri"),
    i18n.t("date.sat"),
  ];

  const pad = (n) => n.toString().padStart(2, "0");

  const day = pad(_date.getDate());
  const month = pad(_date.getMonth() + 1);
  const year = _date.getFullYear();
  const hours = pad(_date.getHours());
  const minutes = pad(_date.getMinutes());

  return `${dayNames[_date.getDay()]} ${day}/${month}/${year} - ${hours}:${minutes}`;
};
