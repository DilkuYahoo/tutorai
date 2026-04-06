import Dashboard from "./components/Dashboard";
import { useApiClientInitialize } from "./hooks/useApiClientInitialize";

function App() {
  useApiClientInitialize();

  return <Dashboard />;
}

export default App;
