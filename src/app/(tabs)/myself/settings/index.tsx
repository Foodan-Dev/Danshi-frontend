import React from 'react';

import SettingsScreen from '@/src/screens/settings_screen';

export default function MyselfSettingsRoute() {
  return (
    <SettingsScreen
      accountHref="/myself/settings/account"
      aboutHref="/myself/settings/about"
    />
  );
}
