import React from 'react';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TimezoneProvider } from './contexts/TimezoneContext';
import AppNavigator from './navigation/AppNavigator';

function App() {
  return (
    <SafeAreaProvider>
      <TimezoneProvider>
        <AppNavigator />
      </TimezoneProvider>
    </SafeAreaProvider>
  );
}

export default App;

registerRootComponent(App);

