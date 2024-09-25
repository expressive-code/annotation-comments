/**
 * Converts possible try-catch error value types to a standard object format.
 *
 * @param error Error object, which could be string, Error, or ResolveMessage.
 * @returns object containing message and, if present, error code.
 */
export function coerceError(error: unknown): { message: string; code?: string | undefined } {
	if (typeof error === 'object' && error !== null && 'message' in error) {
		/* c8 ignore start */
		return error as { message: string; code?: string | undefined }
		/* c8 ignore end */
	}
	/* c8 ignore start */
	return { message: error as string }
	/* c8 ignore end */
}
