import htmlToFormattedText from "html-to-formatted-text";

export const isStringEmpty = (str: string): boolean => str === "";
export const isEmpty = (array: unknown[]): boolean => !array.length;
export const isObjectEmpty = (obj: Record<string, unknown>): boolean => !Object.values(obj).length;

export const convertToMB = (sizeInBytes: number): string => {
  return (sizeInBytes / (1024 * 1024)).toFixed(2);
};

export const formatToPlainText = (htmlString: string): string => {
  return htmlToFormattedText(htmlString);
};

export const getTextLength = (htmlString: string): number => {
  return htmlToFormattedText(htmlString).replace(/\n/g, "").length;
};

export const getTextSize = (htmlString: string): number => {
  return new TextEncoder().encode(htmlString).length;
};

export const capitalize = (str: string = ""): string => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};
