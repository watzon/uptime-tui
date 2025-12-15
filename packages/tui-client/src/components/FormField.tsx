import { Box, Text } from 'ink'
import TextInput from 'ink-text-input'

interface FormFieldProps {
	label: string
	value: string
	onChange: (value: string) => void
	onSubmit?: () => void
	isFocused: boolean
	error?: string | null
	placeholder?: string
}

export function FormField({
	label,
	value,
	onChange,
	onSubmit,
	isFocused,
	error,
	placeholder,
}: FormFieldProps) {
	return (
		<Box flexDirection="column" marginBottom={1}>
			<Box>
				<Text color={isFocused ? 'cyan' : undefined} bold={isFocused}>
					{isFocused ? '> ' : '  '}
					{label}:{' '}
				</Text>
				{isFocused ? (
					<TextInput
						value={value}
						onChange={onChange}
						onSubmit={onSubmit}
						placeholder={placeholder}
					/>
				) : (
					<Text dimColor={!value}>{value || placeholder || '(empty)'}</Text>
				)}
			</Box>
			{error && (
				<Box marginLeft={2}>
					<Text color="red">{error}</Text>
				</Box>
			)}
		</Box>
	)
}
