import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/styles';

type SectionProps = {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
};

export function Section({ eyebrow, title, action, children }: SectionProps) {
  return (
    <View style={sectionStyles.section}>
      <View style={sectionStyles.header}>
        <View style={sectionStyles.heading}>
          {eyebrow ? <Text style={sectionStyles.eyebrow}>{eyebrow}</Text> : null}
          <Text style={sectionStyles.title}>{title}</Text>
        </View>
        {action}
      </View>
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  section: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heading: {
    flex: 1,
    gap: 3,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
});
