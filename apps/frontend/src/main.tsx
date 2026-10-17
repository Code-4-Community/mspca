import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { ChakraProvider } from '@chakra-ui/react';
import { configureAmplify, isAuthEnabled } from './auth/auth.config';
import App from './app';
import { system } from './theme';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

// Configure amplify with cognito (Only runs if the environment variables are set in the .env file)
configureAmplify();

root.render(
  <ChakraProvider value={system}>
    {isAuthEnabled() ? (
      <Authenticator>
        <StrictMode>
          <App />
        </StrictMode>
      </Authenticator>
    ) : (
      <StrictMode>
        <App />
      </StrictMode>
    )}
  </ChakraProvider>,
);
