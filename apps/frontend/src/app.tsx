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

// The sign-in page sits outside Layout, so it has no navbar. Every other page
// is a child of Layout, behind RequireAuth, so only signed-in users see it.
// Page errors are caught by the inner errorElement so the navbar stays put;
// the outer one only catches errors from the layout itself.
export const routes: RouteObject[] = [
  {
    path: ROUTES.SIGN_IN,
    element: <SignIn />,
    errorElement: <NotFound />,
  },
  {
    element: <RequireAuth />,
    errorElement: <NotFound />,
    children: [
      {
        element: <Layout />,
        errorElement: <NotFound />,
        children: [
          {
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
