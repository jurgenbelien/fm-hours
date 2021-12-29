import jwtDecode from 'jwt-decode';
import axios from 'axios';

interface IDecodedToken {
  firebase: {
    sign_in_attributes: {
      [attr: string]: string;
    };
  };
}

interface IBridgeIntractoConnectionInfo {
  user_name: string;
  full_name: string;
  email: string;
  groups: string[];
  cookie_domain: string;
  cookie_value: string;
  cookie_expiration: string;
}

export const SIGN_IN_ATTR =
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/privatepersonalidentifier';

function decodeSamlToken(token: string): IDecodedToken {
  return jwtDecode<IDecodedToken>(token);
}

function getPpid(token: string): string {
  const {sign_in_attributes: signInAttrs} = decodeSamlToken(token).firebase;
  return signInAttrs[SIGN_IN_ATTR];
}

export async function getAuthCookieValue(
  token: string | undefined
): Promise<string> {
  if (!token) {
    throw new Error('Missing auth token');
  }

  const ppid = getPpid(token);

  const {data: connectionInfo} =
    await axios.post<IBridgeIntractoConnectionInfo>(
      `https://auth.hosted-tools.com/api/get-token/hours.frontmen.nl/bridge.hosted-tools.com/${ppid}`
    );

  return `hosted-tools-api-auth-2=${connectionInfo.cookie_value}`;
}