import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { styles } from './src/theme/styles';

export default function App() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <DashboardScreen />
    </SafeAreaView>
  );
}
