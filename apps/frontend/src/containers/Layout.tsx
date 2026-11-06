import { Flex } from '@chakra-ui/react';
import { Outlet } from 'react-router-dom';

import Navbar from '@components/Navbar';

/**
 * Shared app shell: the navbar sits above every page. The column fills the
 * viewport so pages can grow into the remaining height with `flex="1"`.
 */
const Layout: React.FC = () => (
  <Flex direction="column" minH="100vh">
    <Navbar />
    <Outlet />
  </Flex>
);

export default Layout;
