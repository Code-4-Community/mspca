// Cognito user pool group names that map to application roles.
export enum CognitoRole {
  FosterVolunteer = 'FosterVolunteer',
  FosterCoordinator = 'FosterCoordinator',
  Admin = 'Admin',
}

// Resolved Cognito configuration derived from environment variables.
export interface CognitoConfig {
  region: string; // AWS region (ex: us-east-1)
  userPoolId: string; // Cognito user pool ID
  clientId: string; // Cognito app client ID
  issuer: string; // Token issuer URL (ex: https://cognito-idp.<region>.amazonaws.com/<userPoolId>)
}

// We only use access tokens to verify the user's identity and allow access to protected resources.
// Cognito access token: https://docs.aws.amazon.com/cognito/latest/developerguide/amazon-cognito-user-pools-using-the-access-token.html
export interface AccessTokenPayload {
  sub: string; // Subject (unique identifier for the user)
  'cognito:groups'?: string[]; // Groups (ex: ['admin', 'user'])
  iss: string; // Issuer (ex: https://cognito-idp.<Region>.amazonaws.com/<your user pool ID>)
  token_use: 'access'; // Token use (ID or access token from Cognito)
  client_id: string; // Client ID used during authentication (ex: <your client ID>)
  exp: number; // Expiration time (Unix timestamp)
  iat: number; // Issued at time (Unix timestamp)
}
