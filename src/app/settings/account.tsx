import React from 'react';

import AccountSettingsScreen from '@/src/screens/account_settings_screen';

export default function PublicAccountSettingsRoute() {
  return <AccountSettingsScreen settingsHref="/settings" />;
}
