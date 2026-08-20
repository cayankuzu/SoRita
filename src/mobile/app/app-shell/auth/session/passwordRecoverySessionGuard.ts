let activePasswordRecoveryExchanges = 0;

export function isPasswordRecoverySessionExchangeActive() {
  return activePasswordRecoveryExchanges > 0;
}

export async function runWithPasswordRecoverySessionExchange<T>(
  exchange: () => Promise<T>,
) {
  activePasswordRecoveryExchanges += 1;

  try {
    return await exchange();
  } finally {
    activePasswordRecoveryExchanges = Math.max(0, activePasswordRecoveryExchanges - 1);
  }
}
