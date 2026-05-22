export interface AppVersionPlatformInfo {
  version: string;
  changelog: string;
}

export interface AppVersionResponse {
  publishedAt: string;
  releaseUrl: string;
  mobile: AppVersionPlatformInfo;
  desktop: AppVersionPlatformInfo;
}

export interface AppConfigs {
  environment: string;
  apiUrl: string;
  app: {
    version: {
      mobile: string;
      web: string;
    };
    name: string;
    slug: string;
    bundle: string;
    icon: string;
    adaptiveIcon: string;
    favicon: string;
    backgroundColor: string;
    websiteUrl: string;
    playStoreUrl: string;
    appStoreUrl: string;
  };
  notes: {
    daysToDelete: number;
    sizeLimit: number;
    maxKanbanColumns: number;
  };
  cloud: {
    deviceLimit: number;
    secretKey: string;
  };
  sentry: {
    dns: string;
  };
  firebase: {
    appName: string;
  };
}
