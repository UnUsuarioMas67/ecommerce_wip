import { useSession } from './features/auth/use-auth';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';

export default function App() {
  const session = useSession();

  return session === null ? <LoginPage /> : <HomePage />;
}
