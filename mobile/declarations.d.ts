declare var describe: (name: string, fn: () => void) => void;
declare var it: (name: string, fn: () => void) => void;
declare var test: (name: string, fn: () => void) => void;
declare var expect: (value: any) => any;
declare var beforeEach: (fn: () => void) => void;
declare var afterEach: (fn: () => void) => void;
declare var jest: any;
declare var process: any;

declare module 'react-native' {
  export const View: any;
  export const Text: any;
  export const TouchableOpacity: any;
  export const ScrollView: any;
  export const SafeAreaView: any;
  export const StatusBar: any;
  export const StyleSheet: any;
  export const Modal: any;
  export const FlatList: any;
  export const TextInput: any;
  export const ActivityIndicator: any;
  export const RefreshControl: any;
  export const Alert: any;
  export const Switch: any;
  export const useWindowDimensions: () => { width: number; height: number };
  export type ViewStyle = any;
  export type TextStyle = any;
  export type TextInputProps = any;
}

declare module 'react-native-safe-area-context' {
  export const SafeAreaProvider: any;
  export const SafeAreaView: any;
}

declare module 'expo-status-bar' {
  export const StatusBar: any;
}

declare module 'expo' {
  export const registerRootComponent: (component: any) => void;
}

declare module '@react-navigation/native' {
  export const NavigationContainer: any;
  export type NavigatorScreenParams<T> = any;
}

declare module '@react-navigation/native-stack' {
  export const createNativeStackNavigator: <T>() => any;
}

declare module '@react-navigation/bottom-tabs' {
  export const createBottomTabNavigator: <T>() => any;
}

declare module '@react-native-async-storage/async-storage' {
  const AsyncStorage: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
    clear: () => Promise<void>;
    getAllKeys: () => Promise<readonly string[]>;
    multiGet: (keys: readonly string[]) => Promise<readonly [string, string | null][]>;
  };
  export default AsyncStorage;
}

declare module 'react-native-svg' {
  export const Svg: any;
  export const Path: any;
  export const Rect: any;
  export const Circle: any;
  export const Line: any;
  export const Text: any;
  export const G: any;
  export const Defs: any;
  export const LinearGradient: any;
  export const Stop: any;
  export default Svg;
}
