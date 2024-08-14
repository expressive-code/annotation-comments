import prettier from 'eslint-plugin-prettier'
import noOnlyTests from 'eslint-plugin-no-only-tests'
import globals from 'globals'
import tsParser from '@typescript-eslint/parser'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import js from '@eslint/js'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const compat = new FlatCompat({
	baseDirectory: __dirname,
	recommendedConfig: js.configs.recommended,
	allConfig: js.configs.all,
})

export default [
	{
		ignores: ['**/node_modules/*', '**/node_modules', '**/dist/*', '**/dist', '**/.github', '**/.changeset'],
	},
	...compat.extends('eslint:recommended', 'plugin:prettier/recommended'),
	{
		plugins: {
			prettier,
			'no-only-tests': noOnlyTests,
		},

		languageOptions: {
			globals: {
				...globals.node,
				...globals.browser,
			},

			ecmaVersion: 'latest',
			sourceType: 'module',

			parserOptions: {
				tsconfigRootDir: __dirname,
				project: ['./tsconfig.base.json', './packages/*/tsconfig.json'],
			},
		},

		rules: {
			'prettier/prettier': 'warn',
			'no-console': 'warn',
			'no-only-tests/no-only-tests': 'warn',
			'no-mixed-spaces-and-tabs': ['warn', 'smart-tabs'],

			'no-trailing-spaces': [
				'warn',
				{
					skipBlankLines: true,
					ignoreComments: true,
				},
			],

			'no-empty': 'warn',

			'no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^(_.*?|e)$',
				},
			],

			'no-unused-private-class-members': 'warn',
			'no-invalid-this': 'warn',
			'consistent-this': ['warn', 'thisObj'],
			semi: ['warn', 'never'],

			quotes: [
				'warn',
				'single',
				{
					avoidEscape: true,
					allowTemplateLiterals: true,
				},
			],

			'space-before-function-paren': [
				'warn',
				{
					named: 'never',
					anonymous: 'always',
					asyncArrow: 'always',
				},
			],

			'func-call-spacing': ['warn', 'never'],

			'comma-spacing': [
				'warn',
				{
					before: false,
					after: true,
				},
			],

			indent: [
				'warn',
				'tab',
				{
					SwitchCase: 1,
				},
			],

			'brace-style': ['warn', '1tbs'],
			'space-before-blocks': ['warn', 'always'],
			'keyword-spacing': 'warn',
		},
	},
	{
		files: ['**/.*.js'],

		rules: {
			indent: [
				'warn',
				2,
				{
					SwitchCase: 1,
				},
			],
		},
	},
	...compat.extends('plugin:@typescript-eslint/recommended', 'plugin:@typescript-eslint/recommended-requiring-type-checking').map((config) => ({
		...config,
		files: ['**/*.ts'],
	})),
	{
		files: ['**/*.ts'],

		languageOptions: {
			parser: tsParser,
		},

		rules: {
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{
					argsIgnorePattern: '^_',
					destructuredArrayIgnorePattern: '^_',
				},
			],

			'@typescript-eslint/no-empty-function': 'warn',
			'@typescript-eslint/no-non-null-assertion': 'off',
			'@typescript-eslint/no-redundant-type-constituents': 'off',
		},
	},
	{
		files: ['packages/**/test/*.js', 'packages/**/*.test.js'],

		languageOptions: {
			globals: {
				globalThis: false,
			},
		},

		rules: {
			'no-console': 'off',
		},
	},
]
