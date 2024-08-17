import { coerceError } from './errors'

/**
 * Takes a string or existing regular expression as input and returns a regular expression
 * that has the global flag set.
 *
 * If supported by the platform this code is running on, it will also set the `d` flag that
 * enables capture group indices.
 */
export function parseAsGlobalRegExp(pattern: string | RegExp, extraFlags?: string): RegExp {
	let regExp: RegExp | undefined
	try {
		// Try to use regular expressions with capture group indices
		regExp = new RegExp(pattern, 'gd' + (extraFlags || ''))
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
	} catch (_error) {
		try {
			// Use fallback if unsupported
			regExp = new RegExp(pattern, 'g' + (extraFlags || ''))
		} catch (error) {
			throw new Error(`Failed to parse \`${pattern}\` as regular expression: ${coerceError(error).message}`)
		}
	}
	return regExp
}
