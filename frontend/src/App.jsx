import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

import Layout from "./components/Layout";

import AlertsPage from "./pages/AlertsPage";
import DashboardPage from "./pages/DashboardPage";
import GeofencesPage from "./pages/GeofencesPage";
import MapPage from "./pages/MapPage";
import VehiclesPage from "./pages/VehiclesPage";
import ViolationsPage from "./pages/ViolationsPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,

    children: [
      {
        index: true,
        element: <DashboardPage />,
      },
      {
        path: "map",
        element: <MapPage />,
      },
      {
        path: "geofences",
        element: <GeofencesPage />,
      },
      {
        path: "vehicles",
        element: <VehiclesPage />,
      },
      {
        path: "alerts",
        element: <AlertsPage />,
      },
      {
        path: "violations",
        element: <ViolationsPage />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;