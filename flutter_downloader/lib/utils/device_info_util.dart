import 'dart:io';

class DeviceInfoUtil {
  static String getOsType() {
    if (Platform.isWindows) {
      return 'Windows';
    } else if (Platform.isAndroid) {
      return 'Android';
    } else if (Platform.isIOS) {
      return 'iOS';
    } else if (Platform.isMacOS) {
      return 'macOS';
    } else if (Platform.isLinux) {
      return 'Linux';
    } else {
      return 'Unknown';
    }
  }

  static String getOsVersion() {
    try {
      return Platform.operatingSystemVersion;
    } catch (e) {
      print('[DeviceInfo] Error getting OS version: $e');
      return 'Unknown';
    }
  }

  static String getDeviceName() {
    try {
      // Try to get computer/device name from environment
      final hostname = Platform.localHostname;
      if (hostname.isNotEmpty) {
        return hostname;
      }

      // Fallback to environment variable COMPUTERNAME (Windows)
      final computerName = Platform.environment['COMPUTERNAME'];
      if (computerName != null && computerName.isNotEmpty) {
        return computerName;
      }

      // Fallback to environment variable HOSTNAME (Linux/Mac)
      final hostName = Platform.environment['HOSTNAME'];
      if (hostName != null && hostName.isNotEmpty) {
        return hostName;
      }

      // Final fallback
      return 'Unknown Device';
    } catch (e) {
      print('[DeviceInfo] Error getting device name: $e');
      return 'Unknown Device';
    }
  }

  static void printDeviceInfo() {
    print('[DeviceInfo] OS Type: ${getOsType()}');
    print('[DeviceInfo] OS Version: ${getOsVersion()}');
    print('[DeviceInfo] Device Name: ${getDeviceName()}');
  }
}
