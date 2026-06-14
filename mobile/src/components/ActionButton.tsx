import { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/styles';

type ActionButtonProps = {
  label: string;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
};

export function ActionButton({
  label,
  icon,
  variant = 'primary',
  loading = false,
  disabled = false,
  onPress,
}: ActionButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        buttonStyles.button,
        buttonStyles[variant],
        isDisabled && buttonStyles.disabled,
        pressed && !isDisabled && buttonStyles.pressed,
      ]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' ? '#ffffff' : colors.primary} /> : null}
      {!loading && icon ? <View style={buttonStyles.icon}>{icon}</View> : null}
      <Text style={[buttonStyles.label, buttonStyles[`${variant}Label`]]}>{label}</Text>
    </Pressable>
  );
}

const buttonStyles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.primarySoft,
    borderColor: '#a8ded6',
    borderWidth: 1,
  },
  ghost: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  disabled: {
    opacity: 0.55,
  },
  pressed: {
    transform: [{ translateY: 1 }],
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
  },
  primaryLabel: {
    color: '#ffffff',
  },
  secondaryLabel: {
    color: colors.primaryDark,
  },
  ghostLabel: {
    color: colors.text,
  },
  icon: {
    width: 18,
    alignItems: 'center',
  },
});
