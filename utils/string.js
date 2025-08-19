import htmlToFormattedText from "html-to-formatted-text";

export const isStringEmpty = (str) => str === "";
export const isEmpty = (array) => !array.length;
export const isObjectEmpty = (obj) => !Object.values(obj).length;

export const convertToMB = (sizeInBytes) => {
  return (sizeInBytes / (1024 * 1024)).toFixed(2);
};

export const formatToPlainText = (htmlString) => {
  return htmlToFormattedText(htmlString);
};

export const getTextLength = (htmlString) => {
  return htmlToFormattedText(htmlString).replace(/\n/g, "").length;
};

export const getTextSize = (htmlString) => {
  return new TextEncoder().encode(htmlString).length;
};

export const capitalize = (str = "") => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};
