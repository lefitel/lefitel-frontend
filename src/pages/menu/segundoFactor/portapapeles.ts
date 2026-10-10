/**
 * Whether this browser runs on Windows, read from the user agent.
 *
 * Only to decide how a clipboard warning is worded: Windows 11 keeps a history
 * of what was copied (Win+V) that can sync to the Microsoft account, and that is
 * the part of the warning that is false anywhere else.
 */
export const enWindows = (): boolean => /windows/i.test(navigator.userAgent);
