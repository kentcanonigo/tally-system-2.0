import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons } from '@expo/vector-icons';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import TallySessionsScreen from '../screens/TallySessionsScreen';
import TallySessionDetailScreen from '../screens/TallySessionDetailScreen';
import CreateTallySessionScreen from '../screens/CreateTallySessionScreen';
import TallyScreen from '../screens/TallyScreen';
import TallySessionLogsScreen from '../screens/TallySessionLogsScreen';
import TallyTabScreen from '../screens/TallyTabScreen';
import CalculatorScreen from '../screens/CalculatorScreen';
import SettingsScreen from '../screens/SettingsScreen';
import CustomersScreen from '../screens/CustomersScreen';
import WeightClassificationsScreen from '../screens/WeightClassificationsScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function SessionsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="TallySessionsList" component={TallySessionsScreen} />
      <Stack.Screen name="TallySessionDetail" component={TallySessionDetailScreen} />
      <Stack.Screen name="CreateTallySession" component={CreateTallySessionScreen} />
      <Stack.Screen name="Tally" component={TallyScreen} />
      <Stack.Screen name="TallySessionLogs" component={TallySessionLogsScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  const { user } = useAuth();
  
  // Get visible tabs from user preferences, default to all tabs
  const visibleTabs = user?.visible_tabs || [
    'Home',
    'Sessions',
    'Tally',
    'Customers',
    'WeightClassifications',
    'Calculator',
  ];

  // Helper to check if a tab should be visible
  const isTabVisible = (tabName: string) => {
    return tabName === 'Settings' || visibleTabs.includes(tabName);
  };

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: any;

          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Sessions') {
            iconName = 'list';
          } else if (route.name === 'Tally') {
            iconName = 'edit';
          } else if (route.name === 'Customers') {
            iconName = 'people';
          } else if (route.name === 'WeightClassifications') {
            iconName = 'scale';
          } else if (route.name === 'Calculator') {
            iconName = 'calculate';
          } else if (route.name === 'Settings') {
            iconName = 'settings';
          } else {
            iconName = 'help';
          }

          return <MaterialIcons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#3498db',
        tabBarInactiveTintColor: '#7f8c8d',
      })}
    >
      {isTabVisible('Home') && (
        <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      )}
      {isTabVisible('Sessions') && (
        <Tab.Screen name="Sessions" component={SessionsStack} options={{ headerShown: false }} />
      )}
      {isTabVisible('Tally') && (
        <Tab.Screen name="Tally" component={TallyTabScreen} options={{ headerShown: false }} />
      )}
      {isTabVisible('Customers') && (
        <Tab.Screen name="Customers" component={CustomersScreen} options={{ headerShown: false }} />
      )}
      {isTabVisible('WeightClassifications') && (
        <Tab.Screen name="WeightClassifications" component={WeightClassificationsScreen} options={{ headerShown: false }} />
      )}
      {isTabVisible('Calculator') && (
        <Tab.Screen name="Calculator" component={CalculatorScreen} options={{ headerShown: false }} />
      )}
      {/* Settings is always visible */}
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3498db" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="MainTabs" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
});

export default AppNavigator;

