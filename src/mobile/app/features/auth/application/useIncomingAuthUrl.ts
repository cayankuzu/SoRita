import { useEffect, useState } from 'react';
import * as Linking from 'expo-linking';

export type IncomingAuthUrl = {
  /** False until the launch URL has been looked up at least once. */
  resolved: boolean;
  url: string | null;
};

/**
 * Linking.useURL() returns null both before the launch URL is known and when
 * there is none, so a screen cannot tell "no link yet" from "no link at all".
 *
 * That cost us the password reset. React Navigation parses a deep link's query
 * into route params but never its fragment, and Supabase returns the recovery
 * session in the fragment. The reset screen therefore ran on its first render
 * against a payload that could not contain a session, spent the single-use
 * state token on it, and by the time the full URL arrived the token was gone.
 *
 * Reporting resolution explicitly lets a screen wait for the real link.
 */
export function useIncomingAuthUrl(): IncomingAuthUrl {
  const [incoming, setIncoming] = useState<IncomingAuthUrl>({ resolved: false, url: null });

  useEffect(() => {
    let active = true;

    void Linking.getInitialURL()
      .catch(() => null)
      .then((url) => {
        if (!active) {
          return;
        }

        // A url event can land first and is always the newer link; keep it.
        setIncoming((current) => (current.url ? current : { resolved: true, url }));
      });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (active) {
        setIncoming({ resolved: true, url });
      }
    });

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return incoming;
}
