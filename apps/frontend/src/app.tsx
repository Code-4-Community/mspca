import {
  createBrowserRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';

import Root from '@containers/root';
import Layout from '@containers/Layout';
import NotFound from '@containers/404';
import AnimalAvailability from '@pages/AnimalAvailability';
import SignIn from '@pages/SignIn';
import RequireAuth from './auth/RequireAuth';
import { ROUTES } from './routes';

export const routes: RouteObject[] = [
  // Public: no sign-in needed, no navbar.
  {
    path: ROUTES.SIGN_IN,
    element: <SignIn />,
    errorElement: <NotFound />,
  },

  // Public: no sign-in needed, with the navbar (e.g. future landing pages).
  {
    element: <Layout />,
    errorElement: <NotFound />,
    children: [
      // Add public pages here.
    ],
  },

  // Signed in: any role.
  {
    element: <RequireAuth />,
    errorElement: <NotFound />,
    children: [
      {
        element: <Layout />,
        errorElement: <NotFound />,
        children: [
          {
            // Catches page errors below the navbar, so the navbar stays put.
            errorElement: <NotFound />,
            children: [
              { path: '/', element: <Root /> },
              {
                path: ROUTES.ANIMAL_AVAILABILITY,
                element: <AnimalAvailability />,
              },
              { path: '*', element: <NotFound /> },
            ],
          },
        ],
      },
    ],
  },
];

const router = createBrowserRouter(routes);

export const App: React.FC = () => <RouterProvider router={router} />;

export default App;
