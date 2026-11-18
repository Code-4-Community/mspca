import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Authenticator } from '@aws-amplify/ui-react';
import { ChakraProvider } from '@chakra-ui/react';
import { configureAmplify } from './auth/auth.config';
import { UserProvider } from './auth/userContext';
import App from './app';
import { system } from './theme';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

// Configure amplify with cognito (Only runs if the environment variables are set in the .env file)
configureAmplify();

root.render(
  <StrictMode>
    <ChakraProvider value={system}>
      <Authenticator.Provider>
        <UserProvider>
          <App />
        </UserProvider>
      </Authenticator.Provider>
    </ChakraProvider>
  </StrictMode>,
);
