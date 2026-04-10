export const policyRateConfig = {
  source: "manual-policy-rates-v2",
  updatedAt: "2026-04-10T00:00:00.000Z",
  policyRates: {
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
  twoYearYields: {
    USD: 3.96,
    EUR: 2.08,
    GBP: 3.92,
    JPY: 0.86,
    CHF: 0.33,
    CAD: 2.68,
    AUD: 3.42,
    NZD: 3.21,
    NOK: 3.94,
    SEK: 2.01,
    DKK: 2.02,
    MXN: 8.71,
    ZAR: 8.18,
    TRY: 37.8,
    INR: 6.82,
    BRL: 13.88,
    PLN: 5.16,
    THB: 2.03,
    ILS: 4.24,
    CZK: 3.57,
    HUF: 6.11,
  },
  twoYearYieldChange5d: {
    USD: 0.08,
    EUR: 0.02,
    GBP: 0.06,
    JPY: 0.04,
    CHF: -0.01,
    CAD: 0.03,
    AUD: 0.1,
    NZD: 0.05,
    NOK: 0.07,
    SEK: 0.01,
    DKK: 0.01,
    MXN: -0.12,
    ZAR: -0.06,
    TRY: -1.5,
    INR: 0.03,
    BRL: -0.25,
    PLN: -0.04,
    THB: 0.02,
    ILS: 0.05,
    CZK: -0.03,
    HUF: -0.08,
  },
} as const;

export function getPolicyRate(currency: string) {
  return policyRateConfig.policyRates[currency.toUpperCase() as keyof typeof policyRateConfig.policyRates];
}

export function getTwoYearYield(currency: string) {
  return policyRateConfig.twoYearYields[currency.toUpperCase() as keyof typeof policyRateConfig.twoYearYields];
}

export function getTwoYearYieldChange5d(currency: string) {
  return policyRateConfig.twoYearYieldChange5d[currency.toUpperCase() as keyof typeof policyRateConfig.twoYearYieldChange5d];
}