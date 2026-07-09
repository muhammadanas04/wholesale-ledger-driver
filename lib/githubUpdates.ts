import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import Toast from 'react-native-toast-message';

const GITHUB_REPO = 'muhammadanas04/wholesale-ledger-driver';
const APK_NAME = 'driver-app.apk';

/**
 * Strips 'v' and compares semver-like strings (e.g. '1.0.0' vs '1.0.1').
 * Returns 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
 */
function compareVersions(v1: string, v2: string) {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number);
  const parts2 = v2.replace(/^v/, '').split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

export async function checkGitHubUpdate() {
  if (Platform.OS !== 'android') return null;

  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
    if (!response.ok) {
      console.log('[GitHubUpdates] Failed to fetch latest release.');
      return null;
    }
    
    const release = await response.json();
    const currentVersion = Constants.expoConfig?.version || '0.0.0';
    const latestVersion = release.tag_name;

    if (compareVersions(latestVersion, currentVersion) > 0) {
      const asset = release.assets.find((a: any) => a.name === APK_NAME);
      if (asset) {
        return {
          version: latestVersion,
          downloadUrl: asset.browser_download_url
        };
      }
    }
  } catch (error) {
    console.log('[GitHubUpdates] Error checking for updates:', error);
  }
  return null;
}

export async function downloadAndInstallApk(downloadUrl: string) {
  if (Platform.OS !== 'android') return;

  try {
    const fileUri = `${FileSystem.documentDirectory}${APK_NAME}`;
    
    try {
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(fileUri);
      }
    } catch (e) {
      // Ignore
    }

    let lastUpdate = 0;
    const downloadResumable = FileSystem.createDownloadResumable(
      downloadUrl,
      fileUri,
      {},
      (downloadProgress) => {
        const progress = Math.round((downloadProgress.totalBytesWritten / downloadProgress.totalBytesExpectedToWrite) * 100);
        if (progress >= lastUpdate + 5 || progress === 100) {
          lastUpdate = progress;
          Toast.show({
            type: 'info',
            text1: 'Downloading update...',
            text2: `Progress: ${progress}%`,
            autoHide: false,
          });
        }
      }
    );

    const downloadResult = await downloadResumable.downloadAsync();
    
    Toast.hide();

    if (!downloadResult || downloadResult.status !== 200) {
      throw new Error('Failed to download APK');
    }

    // Get content URI using expo-file-system
    const contentUri = await FileSystem.getContentUriAsync(downloadResult.uri);
    
    // Launch installer
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/vnd.android.package-archive',
    });
  } catch (error) {
    Toast.hide();
    console.error('[GitHubUpdates] Error downloading or installing APK:', error);
    throw error;
  }
}
