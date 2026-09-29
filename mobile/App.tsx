import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { WebView, type WebViewMessageEvent, type WebViewNavigation } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { handleRequest, parseMessage, playHaptics, replyScript } from "./src/bridge";

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? "";
const BACKGROUND = "#06080f";

SplashScreen.preventAutoHideAsync().catch((error: unknown) => console.error("Splash screen could not be held", error));

function originOf(url: string) {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

export default function App() {
  const webRef = useRef<WebView>(null);
  const canGoBack = useRef(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const appOrigin = useMemo(() => originOf(WEB_URL), []);

  const hideSplash = useCallback(() => {
    SplashScreen.hideAsync().catch((error: unknown) => console.error("Splash screen could not be hidden", error));
  }, []);

  useEffect(() => {
    if (!appOrigin) hideSplash();
  }, [appOrigin, hideSplash]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!canGoBack.current) return false;
      webRef.current?.goBack();
      return true;
    });
    return () => subscription.remove();
  }, []);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (originOf(event.nativeEvent.url) !== appOrigin) {
        console.error("Ignored bridge message from an unexpected origin", event.nativeEvent.url);
        return;
      }
      const message = parseMessage(event.nativeEvent.data);
      if (!message) return;
      if (message.type === "haptic") {
        playHaptics(message.payload.pattern);
        return;
      }
      handleRequest(message)
        .then((result) => webRef.current?.injectJavaScript(replyScript(message.id, true, result)))
        .catch((error: unknown) => {
          console.error(`Bridge request "${message.type}" failed`, error);
          webRef.current?.injectJavaScript(replyScript(message.id, false, error instanceof Error ? error.message : String(error)));
        });
    },
    [appOrigin],
  );

  const onShouldStartLoad = useCallback(
    (request: ShouldStartLoadRequest) => {
      const { url } = request;
      if (url.startsWith("about:") || url.startsWith("blob:") || url.startsWith("data:")) return true;
      if (originOf(url) === appOrigin) return true;
      Linking.openURL(url).catch((error: unknown) => console.error("External link could not be opened", error));
      return false;
    },
    [appOrigin],
  );

  const onNavigation = useCallback((state: WebViewNavigation) => {
    canGoBack.current = state.canGoBack;
  }, []);

  const retry = useCallback(() => {
    setFailed(false);
    setAttempt((value) => value + 1);
  }, []);

  if (!appOrigin) {
    return (
      <View style={styles.center}>
        <StatusBar style="light" />
        <Text style={styles.title}>EXPO_PUBLIC_WEB_URL eksik</Text>
        <Text style={styles.body}>mobile/.env dosyasına web uygulamasının adresini yaz.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      {failed ? (
        <View style={styles.center}>
          <Text style={styles.title}>Bağlantı kurulamadı</Text>
          <Text style={styles.body}>İnternet bağlantını kontrol edip yeniden dene.</Text>
          <Pressable onPress={retry} style={styles.button} accessibilityRole="button">
            <Text style={styles.buttonText}>Yeniden dene</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          key={attempt}
          ref={webRef}
          source={{ uri: WEB_URL }}
          style={styles.web}
          containerStyle={styles.web}
          originWhitelist={["https://*", "http://*"]}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsBackForwardNavigationGestures={false}
          setSupportMultipleWindows={false}
          contentInsetAdjustmentBehavior="never"
          overScrollMode="never"
          bounces={false}
          webviewDebuggingEnabled={__DEV__}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={onShouldStartLoad}
          onNavigationStateChange={onNavigation}
          onLoadEnd={hideSplash}
          onError={(event) => {
            console.error("Web app failed to load", event.nativeEvent.description);
            setFailed(true);
            hideSplash();
          }}
          onHttpError={(event) => {
            if (event.nativeEvent.statusCode >= 500) {
              console.error("Web app returned a server error", event.nativeEvent.statusCode);
              setFailed(true);
              hideSplash();
            }
          }}
          onContentProcessDidTerminate={() => {
            console.error("Web content process terminated; reloading");
            webRef.current?.reload();
          }}
          onRenderProcessGone={() => {
            console.error("Web render process gone; reloading");
            setAttempt((value) => value + 1);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BACKGROUND },
  web: { flex: 1, backgroundColor: BACKGROUND },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32, backgroundColor: BACKGROUND },
  title: { color: "#ecd08a", fontSize: 22, fontWeight: "600", textAlign: "center" },
  body: { color: "rgba(239,227,200,0.8)", fontSize: 16, textAlign: "center", lineHeight: 22 },
  button: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999, backgroundColor: "#d9b25e" },
  buttonText: { color: "#1a1008", fontSize: 17, fontWeight: "600" },
});
