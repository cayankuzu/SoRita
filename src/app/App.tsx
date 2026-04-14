import { AppProviders } from '@/app/app-shell/providers/AppProviders';
import { RootNavigator } from '@/app/app-shell/navigation/RootNavigator';

export default function App() {
  return (
    <AppProviders>
      <RootNavigator />
    </AppProviders>
  );
}
