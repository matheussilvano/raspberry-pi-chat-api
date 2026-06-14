import { StyleSheet } from 'react-native';

export const colors = {
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  border: '#dbe3ef',
  text: '#172033',
  muted: '#667085',
  primary: '#0f766e',
  primaryDark: '#115e59',
  primarySoft: '#d9f6f1',
  danger: '#b42318',
  success: '#027a48',
  warning: '#b54708',
};

export const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
