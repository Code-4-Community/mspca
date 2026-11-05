import { Outlet } from 'react-router-dom';

import Navbar from '@components/Navbar';

/** Shared app shell: the navbar sits above every page. */
const Layout: React.FC = () => (
  <>
    <Navbar />
    <Outlet />
  </>
);

export default Layout;
