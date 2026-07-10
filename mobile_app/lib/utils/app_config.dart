// App configuration constants
// The Mapbox token is injected at build time via --dart-define=MAPBOX_TOKEN=pk.xxx
// Example: flutter build apk --release --dart-define=MAPBOX_TOKEN=pk.eyJ1...
// For local development, set the token in your CI/CD environment or pass it manually.
class AppConfig {
  // Mapbox public token - injected at build time, never commit real tokens here
  static const String mapboxPublicToken =
      String.fromEnvironment('MAPBOX_TOKEN', defaultValue: '');
}
