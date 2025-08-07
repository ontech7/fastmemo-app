// @ts-ignore
import htmlToFormattedText from "html-to-formatted-text";

export const isStringEmpty = (str: string) => str === "";

export const convertToMB = (sizeInBytes: number) => {
  return (sizeInBytes / (1024 * 1024)).toFixed(2);
};

export const getTextLength = (htmlString: string) => {
  return htmlToFormattedText(htmlString).replace(/\n/g, "").length;
};

export const getTextSize = (htmlString: string) => {
  return new TextEncoder().encode(htmlString).length;
};
