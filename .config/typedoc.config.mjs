// @ts-check
/** @type {Partial<import("typedoc").TypeDocOptions> & Partial<import("typedoc-plugin-markdown").PluginOptions> & Partial<import("typedoc-plugin-remark").PluginOptions>} */
const config = {
	entryPoints: ['../packages/annotation-comments/src/index.ts'],
	tsconfig: '../packages/annotation-comments/tsconfig.json',
	plugin: ['typedoc-plugin-markdown', 'typedoc-plugin-remark'],

	// What to include in the output
	disableSources: true,
	excludeExternals: true,
	excludeInternal: true,
	excludePrivate: true,
	excludeProtected: true,
	hideGenerator: true,
	hidePageHeader: true,
	expandObjects: true,
	expandParameters: true,
	useCodeBlocks: true,
	typeDeclarationVisibility: 'compact',

	// Add custom preamble
	mergeReadme: true,
	readme: './typedoc.preamble.md',

	// How to sort and group the output
	sort: ['required-first', 'alphabetical'],
	groupOrder: ['Classes', 'Constructors', 'Functions', 'Methods', 'Accessors', 'Variables', 'Interfaces', 'Type Aliases', '*'],

	// Output location
	outputFileStrategy: 'modules',

	// Markdown-specific settings
	outputs: [
		{
			name: 'markdown',
			path: '../packages/annotation-comments',
			options: {
				cleanOutputDir: false,
			},
		},
	],
	remarkStringifyOptions: {
		bullet: '-',
		handlers: {
			text: (node, _, state, info) => state.safe(node.value, info).replace(/\r?\n/g, ' '),
		},
	},
	remarkPlugins: [
		[
			'remark-link-rewrite',
			{
				replacer: (url) => url.replace(/^.*?\.md#/g, '#'),
			},
		],
	],
}

export default config
