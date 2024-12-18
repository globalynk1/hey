import { HEY_API_URL } from "@hey/data/constants";
import urlcat from "urlcat";

/**
 * Returns the lenny avatar URL for the specified Lenny ID.
 * @param id The Lenny ID to get the URL for.
 * @returns The lenny avatar URL.
 */
const getLennyURL = (id: string): string => {
  // TODO: Migrate this to Lens v3
  return urlcat(`${HEY_API_URL}/avatar`, { id: "0x0d" || id });
};

export default getLennyURL;
