module.exports = ({ config }) => {
  return {
    ...config,
    extra: {
      ...config.extra,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || '',
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '',
      apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || 'https://edgejournal.app',
    },
  };
};
