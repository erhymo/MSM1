export const policyRateConfig = {
  source: "manual-policy-rates-v1",
  updatedAt: "2026-04-10T00:00:00.000Z",
  rates: {
    USD: 4.5,
    EUR: 2.5,
    GBP: 4.5,
    JPY: 0.5,
    CHF: 0.25,
    CAD: 2.75,
    AUD: 3.85,
    NZD: 3.5,
    NOK: 4.25,
    SEK: 2.25,
    DKK: 2.1,
    MXN: 8.5,
    ZAR: 7.5,
    TRY: 42.5,
    INR: 6.25,
    BRL: 14.25,
    PLN: 5.75,
    THB: 2,
    ILS: 4.5,
    CZK: 3.75,
    HUF: 6.5,
  },
} as const;

export function getPolicyRate(currency: string) {
  return policyRateConfig.rates[currency.toUpperCase() as keyof typeof policyRateConfig.rates];
}