export function escapeRegExp(input: string) {
	return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Returns a regular expression that can be used to match escape sequences in a string.
 *
 * It matches any backslash followed by any character that is either a backslash
 * or one of the specified value end delimiters.
 *
 * All other backslashes are not matched because users may not know that they need
 * to be escaped in the first place.
 */
export function getEscapeSequenceRegExp(...valueEndDelimiters: string[]): RegExp {
	return new RegExp(`\\\\(${['\\', ...valueEndDelimiters].map(escapeRegExp).join('|')})`, 'g')
}
