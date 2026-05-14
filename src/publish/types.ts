export interface PublishOptions {
  title: string;
  body: string;
  tags: string[];
  coverText?: string;
  imagePaths?: string[];
}

export interface PublishResult {
  success: boolean;
  postId?: string;
  postUrl?: string;
  error?: string;
}

export interface PlatformPublisher {
  name: string;
  publish(options: PublishOptions): Promise<PublishResult>;
  isLoggedIn(): Promise<boolean>;
  login(): Promise<boolean>;
}
