import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { ChakraProvider } from '@chakra-ui/react';
import { configureAmplify, isAuthEnabled } from './auth/auth.config';
import App from './app';
import { system } from './theme';
import { UserProvider } from './auth/userContext';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

// Configure amplify with cognito (Only runs if the environment variables are set in the .env file)
configureAmplify();

root.render(
  <StrictMode>
    <ChakraProvider value={system}>
      <Authenticator.Provider>
        {isAuthEnabled() ? (
          <Authenticator>
            <UserProvider>
              <App />
            </UserProvider>
          </Authenticator>
        ) : (
          <UserProvider>
            <App />
          </UserProvider>
        )}
      </Authenticator.Provider>
    </ChakraProvider>
  </StrictMode>,
);
