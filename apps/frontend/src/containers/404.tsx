import { useRouteError } from 'react-router-dom';

import { getErrorMessage } from '@utils/router';

const NotFound: React.FC = () => {
  const error = useRouteError();

  // Rendered by the catch-all route for unknown URLs, so there is no error.
  if (error == null) {
    return (
      <div id="error-page">
        <h1>Page not found</h1>
        <p>Sorry, we couldn't find the page you're looking for.</p>
      </div>
    );
  }

  return (
    <div id="error-page">
      <h1>Oops!</h1>
      <p>Sorry, an unexpected error has occurred.</p>
      <p>
        <i>{getErrorMessage(error)}</i>
      </p>
    </div>
  );
};

export default NotFound;
