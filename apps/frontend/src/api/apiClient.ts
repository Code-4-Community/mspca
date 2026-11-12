import axios, { type AxiosInstance } from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

import { isAuthEnabled } from '../auth/auth.config';
import type { Animal, CreateMatchBody, Match } from '../types';

const defaultBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export class ApiClient {
  private axiosInstance: AxiosInstance;

  constructor() {
    this.axiosInstance = axios.create({ baseURL: defaultBaseUrl });

    /**
     * Attaches the Cognito ACCESS token to every outgoing request as
     * `Authorization: Bearer <access_token>`
     *
     * `fetchAuthSession()` returns the cached access token and transparently
     * refreshes it using the stored refresh token when it has expired, so the
     * default 1 hour token lifetime needs no handling here.
     */
    this.axiosInstance.interceptors.request.use(async (config) => {
      // No Cognito env vars means auth is disabled app-wide; send as-is.
      if (!isAuthEnabled()) {
        return config;
      }

      // Send the request unauthenticated if fetchAuthSession resolves with 'tokens: undefined'
      // only temporary failures reach here: network error, Cognito 5xx, throttling.
      // Expect 401 error (thrown by guard) if there is no Bearer token attached
      try {
        const { tokens } = await fetchAuthSession();
        const accessToken = tokens?.accessToken?.toString();
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
      } catch {
        console.error(
          'Cognito session lookup failed; sending request unauthenticated',
        );
      }

      return config;
    });
  }

  public async getAnimals(): Promise<Animal[]> {
    return this.get('/api/animals') as Promise<Animal[]>;
  }

  public async createMatch(body: CreateMatchBody): Promise<Match> {
    return this.post('/api/matches', body) as Promise<Match>;
  }

  public async getHello(): Promise<string> {
    return this.get('/api') as Promise<string>;
  }

  private async get(path: string): Promise<unknown> {
    return this.axiosInstance.get(path).then((response) => response.data);
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    return this.axiosInstance
      .post(path, body)
      .then((response) => response.data);
  }

  private async patch(path: string, body: unknown): Promise<unknown> {
    return this.axiosInstance
      .patch(path, body)
      .then((response) => response.data);
  }

  private async delete(path: string): Promise<unknown> {
    return this.axiosInstance.delete(path).then((response) => response.data);
  }
}

export default new ApiClient();
