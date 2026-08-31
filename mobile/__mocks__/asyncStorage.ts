// In-memory AsyncStorage mock for Vitest
const storage: Record<string, string> = {};

const AsyncStorage = {
  getItem: async (key: string) => storage[key] || null,
  setItem: async (key: string, value: string) => {
    storage[key] = value;
  },
  removeItem: async (key: string) => {
    delete storage[key];
  },
  clear: async () => {
    Object.keys(storage).forEach((k) => delete storage[k]);
  },
  getAllKeys: async () => Object.keys(storage),
  multiGet: async (keys: string[]) => keys.map((k) => [k, storage[k] || null] as [string, string | null]),
};

export default AsyncStorage;
