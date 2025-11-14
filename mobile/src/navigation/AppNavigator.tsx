import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import HomeScreen from '../screens/HomeScreen';
import TallySessionsScreen from '../screens/TallySessionsScreen';
import TallySessionDetailScreen from '../screens/TallySessionDetailScreen';
import CreateTallySessionScreen from '../screens/CreateTallySessionScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function SessionsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="TallySessionsList" component={TallySessionsScreen} options={{ title: 'Tally Sessions' }} />
      <Stack.Screen name="TallySessionDetail" component={TallySessionDetailScreen} options={{ title: 'Session Details' }} />
      <Stack.Screen name="CreateTallySession" component={CreateTallySessionScreen} options={{ title: 'New Session' }} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator>
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Sessions" component={SessionsStack} options={{ headerShown: false }} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;

