import React from 'react';
import { Redirect } from 'expo-router';
import { View, ActivityIndicator } from 'react-native';
import { useAuth } from '@/src/context/auth_context';
import { useTheme } from '@/src/context/theme_context';

export default function RootIndex() {
	const { userToken, isLoading } = useAuth();
	const theme = useTheme();
	if (isLoading) {
		return (
			<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background }}>
				<ActivityIndicator />
			</View>
		);
	}
	if (!userToken) {
		return <Redirect href="/login" />;
	}
	return <Redirect href="/explore" />;
}
