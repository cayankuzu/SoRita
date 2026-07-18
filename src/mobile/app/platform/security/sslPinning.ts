export interface SslPin {
  hostname: string;
  pins: string[];
  includeSubdomains: boolean;
}

/**
 * SSL pinning is intentionally not enforced in this build. Enabling it requires
 * a native pinning library, monitored SPKI rotation, and at least one backup pin.
 * Do not add placeholder pins here; an empty list makes the runtime posture clear.
 */
export const SSL_PINS: SslPin[] = [];

export const SSL_PINNING_ENABLED = false;
