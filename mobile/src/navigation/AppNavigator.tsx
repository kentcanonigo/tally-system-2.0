import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import TallySessionsScreen from '../screens/TallySessionsScreen';
import TallySessionDetailScreen from '../screens/TallySessionDetailScreen';
import CreateTallySessionScreen from '../screens/CreateTallySessionScreen';
import TallyScreen from '../screens/TallyScreen';
import TallySessionLogsScreen from '../screens/TallySessionLogsScreen';
import CalculatorScreen from '../screens/CalculatorScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CustomersScreen from '../screens/CustomersScreen';
import PlantsScreen from '../screens/PlantsScreen';
import WeightClassificationsScreen from '../screens/WeightClassificationsScreen';
import ExportScreen from '../screens/ExportScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function SessionsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="TallySessionsList" component={TallySessionsScreen} options={{ title: 'Tally Sessions' }} />
      <Stack.Screen name="TallySessionDetail" component={TallySessionDetailScreen} options={{ title: 'Session Details' }} />
      <Stack.Screen name="CreateTallySession" component={CreateTallySessionScreen} options={{ title: 'New Session' }} />
      <Stack.Screen name="Tally" component={TallyScreen} options={{ title: 'Tally' }} />
      <Stack.Screen name="TallySessionLogs" component={TallySessionLogsScreen} options={{ title: 'Session Logs' }} />
    </Stack.Navigator>
  );
}

function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName: any;

            if (route.name === 'Home') {
              iconName = 'home';
            } else if (route.name === 'Sessions') {
              iconName = 'list';
            } else if (route.name === 'Customers') {
              iconName = 'people';
            } else if (route.name === 'Plants') {
              iconName = 'business';
            } else if (route.name === 'WeightClassifications') {
              iconName = 'scale';
            } else if (route.name === 'Calculator') {
              iconName = 'calculate';
            } else if (route.name === 'Settings') {
              iconName = 'settings';
            } else if (route.name === 'Export') {
              iconName = 'file-download';
            } else {
              iconName = 'help';
            }

            return <MaterialIcons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#3498db',
          tabBarInactiveTintColor: '#7f8c8d',
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Sessions" component={SessionsStack} options={{ headerShown: false }} />
        <Tab.Screen name="Customers" component={CustomersScreen} />
        <Tab.Screen name="Plants" component={PlantsScreen} />
        <Tab.Screen name="WeightClassifications" component={WeightClassificationsScreen} options={{ title: 'Weight Classes' }} />
        <Tab.Screen name="Calculator" component={CalculatorScreen} options={{ headerShown: false }} />
        <Tab.Screen name="Export" component={ExportScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;

