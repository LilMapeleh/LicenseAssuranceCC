import { type Configuration, PublicClientApplication, type PopupRequest } from "@azure/msal-browser";

export const loginRequest: PopupRequest = {
  scopes: ["User.Read"],
};

const tenantId = process.env.NEXT_PUBLIC_AZURE_TENANT_ID ?? "91700184-c314-4dc9-bb7e-a411df456a1e";

const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID ?? "9ddeec0f-50ce-4433-abb1-473942ac6816",
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: "/",
  },
  cache: {
    cacheLocation: "localStorage",
  },
};

let instance: PublicClientApplication | null = null;
let ready: Promise<PublicClientApplication> | null = null;

export function ensureMsal(): Promise<PublicClientApplication> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MSAL is only available in the browser"));
  }

  if (!instance) {
    instance = new PublicClientApplication({
      ...msalConfig,
      auth: {
        ...msalConfig.auth,
        redirectUri: window.location.origin,
      },
    });
  }

  if (!ready) {
    const pca = instance;
    ready = pca
      .initialize()
      .then(() => pca.handleRedirectPromise())
      .then(() => pca);
  }

  return ready;
}
