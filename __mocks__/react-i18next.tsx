const useMock = () => ({
  t: (key: string, opts?: Record<string, unknown>) =>
    (opts?.defaultValue as string | undefined) ?? key,
  i18n: {
    language: "en",
    changeLanguage: () => Promise.resolve(),
  },
});

module.exports = {
  useTranslation: useMock,
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  Trans: ({ children }: { children: React.ReactNode }) => children,
};
