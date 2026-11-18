class AppConfig {
  static const String mapboxPublicToken =
      String.fromEnvironment('MAPBOX_TOKEN', defaultValue: '');
}
