import { useEffect } from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  type RouteObject,
} from 'react-router-dom';

import apiClient from '@api/apiClient';
import Root from '@containers/root';
import Layout from '@containers/Layout';
import NotFound from '@containers/404';
import Test from '@containers/test';
import AnimalAvailability from '@pages/AnimalAvailability';
import { ROUTES } from './routes';

// Every page is a child of Layout so the navbar renders once, above all pages.
// Page errors are caught by the inner errorElement so the navbar stays put;
// the outer one only catches errors from the layout itself.
export const routes: RouteObject[] = [
  {
    element: <Layout />,
    errorElement: <NotFound />,
    children: [
      {
        errorElement: <NotFound />,
        children: [
          { path: '/', element: <Root /> },
          { path: '/test', element: <Test /> },
          {
            path: ROUTES.ANIMAL_AVAILABILITY,
            element: <AnimalAvailability />,
          },
          { path: '*', element: <NotFound /> },
        ],
      },
    ],
  },
];

const router = createBrowserRouter(routes);

export const App: React.FC = () => {
  useEffect(() => {
    apiClient.getHello().then((res) => console.log(res));
  }, []);

  return <RouterProvider router={router} />;
};

export default App;
