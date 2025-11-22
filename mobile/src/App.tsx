import React from 'react';
import { registerRootComponent } from 'expo';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { TimezoneProvider } from './contexts/TimezoneContext';
import { PlantProvider } from './contexts/PlantContext';
import AppNavigator from './navigation/AppNavigator';

function App() {
  return (
    <SafeAreaProvider>
      <TimezoneProvider>
        <PlantProvider>
          <AppNavigator />
        </PlantProvider>
      </TimezoneProvider>
    </SafeAreaProvider>
  );
}

export default App;

registerRootComponent(App);

