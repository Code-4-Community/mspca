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
import VolunteerProfile from '@pages/VolunteerProfile';
import RequireAuth from './auth/RequireAuth';
import { ROUTES } from './routes';

export const routes: RouteObject[] = [
  // Public: no sign-in needed, no navbar.
  {
    path: ROUTES.SIGN_IN,
    element: <SignIn />,
    // Catches errors on the sign-in page.
    errorElement: <NotFound />,
  },

  // Public: no sign-in needed, with the navbar (e.g. future landing pages).
  {
    element: <Layout />,
    // Catches errors in the navbar or a public page, replacing the whole screen.
    errorElement: <NotFound />,
    children: [
      // Add public pages here.
    ],
  },

  // Signed in: any role.
  {
    element: <RequireAuth />,
    // Catches errors in RequireAuth itself, while checking who is signed in.
    errorElement: <NotFound />,
    children: [
      {
        element: <Layout />,
        // Catches errors in the layout itself (e.g. the navbar), replacing the
        // whole screen.
        errorElement: <NotFound />,
        children: [
          {
            // Catches errors in a page, shown below the navbar.
            errorElement: <NotFound />,
            children: [
              { path: '/', element: <Root /> },
              {
                path: ROUTES.ANIMAL_AVAILABILITY,
                element: <AnimalAvailability />,
              },
              {
                path: ROUTES.VOLUNTEER_PROFILE,
                element: <VolunteerProfile />,
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
