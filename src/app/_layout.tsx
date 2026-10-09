import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack initialRouteName="intro" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="intro" />
        <Stack.Screen name="index" />
      </Stack>
    </>
  );
}