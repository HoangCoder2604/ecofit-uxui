import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

const svgLoads = new Map<number, Promise<string>>();

// RN's fetch(file://...) cannot reliably read Expo Go's encoded cache paths
// on Android. Read the downloaded asset through the native filesystem instead.
export function loadSvg(source: number): Promise<string> {
  const cached = svgLoads.get(source);
  if (cached) return cached;

  const loading = Promise.resolve().then(async () => {
    const registered = Asset.fromModule(source);
    if (Platform.OS === 'web') {
      const response = await fetch(registered.uri);
      if (!response.ok) throw new Error('Cannot load SVG asset: ' + registered.name);
      return response.text();
    }
    const asset = await registered.downloadAsync();
    // Standalone Android builds can resolve bundled images to a raw resource
    // name. Materialize that resource as a cache file before reading it.
    const local = asset.localUri && !asset.localUri.includes(':')
      ? await Asset.fromURI(asset.uri).downloadAsync()
      : asset;
    if (!local.localUri) throw new Error('SVG asset has no local file: ' + asset.name);
    return new File(local.localUri).text();
  }).catch(error => {
    svgLoads.delete(source);
    throw error;
  });
  svgLoads.set(source, loading);
  return loading;
}
