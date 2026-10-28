export interface AppVersionPlatformInfo {
  version: string;
  changelog: string;
}

export interface AppVersionResponse {
  publishedAt: string;
  releaseUrl: string;
  /** `apkUrl`: the GitHub APK attached to the release (ADR-031); missing on older sites and on a release without one. */
  mobile: AppVersionPlatformInfo & { apkUrl?: string };
  /** `releaseUrl`: the release holding the desktop builds (a desktop-only hotfix has its own); missing on older sites. */
  desktop: AppVersionPlatformInfo & { releaseUrl?: string };
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
