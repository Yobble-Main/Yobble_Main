package com.Benno111.dorfplatformertimetravel;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.Manifest;
import android.os.Build;
import android.net.Uri;
import android.os.Bundle;
import android.os.Message;
import android.webkit.ConsoleMessage;
import android.webkit.MimeTypeMap;
import android.view.View;
import android.view.KeyEvent;
import android.util.Base64;
import android.util.Log;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.os.Looper;
import android.view.ViewGroup;

import androidx.core.app.ActivityCompat;
import androidx.webkit.WebViewAssetLoader;

import org.json.JSONTokener;

import java.util.Locale;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final String TAG = "MainActivity";

    private WebView webView;
    private ViewGroup webViewContainer;
    private StorageExporter storageExporter;
    private String initialLocalStorageSnapshot;
    private boolean hasRestoredLocalStorage = false;
    private WebViewAssetLoader assetLoader;

    private final WebViewClient externalTabClient = new WebViewClient() {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            boolean handled = openUrlExternally(request.getUrl());
            view.destroy();
            return handled;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            boolean handled = openUrlExternally(Uri.parse(url));
            view.destroy();
            return handled;
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Prevent accidental WebView calls off the UI thread
        if (Looper.myLooper() != Looper.getMainLooper()) {
            throw new RuntimeException("WebView must run on the MAIN/UI thread!");
        }

        // Lock device orientation
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);

        // Fullscreen mode
        hideSystemUI();

        setContentView(R.layout.main);
        webViewContainer = findViewById(R.id.webview_container);

        storageExporter = new StorageExporter(this);
        initialLocalStorageSnapshot = storageExporter.readLocalStorageSnapshot();
        ensureLegacyStoragePermission();
        assetLoader = new WebViewAssetLoader.Builder()
                .setDomain("appassets.androidplatform.net")
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        // Initialize WebView only on main thread
        webView = GameWebViewHolder.get(this).acquire(this);
        attachWebView();
        configureWebViewSettings();
        webView.clearCache(true);
        webView.clearHistory();
        webView.clearFormData();
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                if (request != null && !"GET".equalsIgnoreCase(request.getMethod())) {
                    return super.shouldInterceptRequest(view, request);
                }
                Uri uri = request.getUrl();
                WebResourceResponse asset = assetLoader.shouldInterceptRequest(uri);
                if (asset != null) return asset;
                WebResourceResponse assetFile = interceptAssetRequest(uri);
                if (assetFile != null) return assetFile;
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
                Uri uri = Uri.parse(url);
                WebResourceResponse asset = assetLoader.shouldInterceptRequest(uri);
                if (asset != null) return asset;
                WebResourceResponse assetFile = interceptAssetRequest(uri);
                if (assetFile != null) return assetFile;
                return super.shouldInterceptRequest(view, url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                if (is404PageUrl(url)) {
                    return;
                }
                if (!hasRestoredLocalStorage && initialLocalStorageSnapshot != null && !initialLocalStorageSnapshot.isEmpty()) {
                    hasRestoredLocalStorage = true;
                    restoreLocalStorageSnapshot(initialLocalStorageSnapshot);
                    initialLocalStorageSnapshot = null;
                    return;
                }
                exportLocalStorageSnapshot();
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                WebView newWebView = new WebView(MainActivity.this);
                newWebView.setWebViewClient(externalTabClient);

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(newWebView);
                resultMsg.sendToTarget();
                return true;
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage consoleMessage) {
                Log.d(TAG, "JS Console: [" + consoleMessage.messageLevel() + "] "
                        + consoleMessage.message() + " ("
                        + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber() + ")");
                return super.onConsoleMessage(consoleMessage);
            }
        });

        // ✅ Load game HTML
        webView.loadUrl("http://photography-cage.gl.at.ply.gg:52426/");

        // Enable Chrome remote debugging to inspect console/network in dev tools
        WebView.setWebContentsDebuggingEnabled(true);
    }

    // ✅ When app loses focus → pause JS, media, timers, background work
    @Override
    protected void onPause() {
        super.onPause();
        try {
            webView.onPause();      // pause audio/video
            webView.pauseTimers();  // pause JavaScript timers & workers
        } catch (Exception e) {}

        // ✅ Stop any threads you manually created here
        // Example:
        // if (myThread != null && myThread.isAlive()) myThread.interrupt();
        // if (executorService != null) executorService.shutdownNow();
    }

    // ✅ Resume WebView & JS only when activity is visible
    @Override
    protected void onResume() {
        super.onResume();
        webView.onResume();
        webView.resumeTimers();
        hideSystemUI();
        ensureWebViewFocus();
    }

    @Override
    protected void onDestroy() {
        if (webViewContainer != null && webView != null && webView.getParent() == webViewContainer) {
            webViewContainer.removeView(webView);
        }
        GameWebViewHolder.get(this).releaseToAppContext();
        super.onDestroy();
    }

    private void hideSystemUI() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
        );
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
            ensureWebViewFocus();
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null) {
            webView.dispatchKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, KeyEvent.KEYCODE_P));
            webView.dispatchKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, KeyEvent.KEYCODE_P));
        }
    }

    private boolean openUrlExternally(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private void ensureWebViewFocus() {
        if (webView != null) {
            webView.requestFocus();
            webView.requestFocusFromTouch();
        }
    }

    private void attachWebView() {
        if (webViewContainer == null || webView == null) return;
        if (webView.getParent() != null && webView.getParent() != webViewContainer) {
            ((ViewGroup) webView.getParent()).removeView(webView);
        }
        if (webView.getParent() == null) {
            webViewContainer.addView(webView,
                    new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT));
        }
    }

    private boolean is404PageUrl(String url) {
        if (url == null || url.isEmpty()) return false;
        try {
            Uri uri = Uri.parse(url);
            String path = uri.getPath();
            if (path == null || path.isEmpty()) return false;
            return path.equals("/404")
                    || path.equals("/404.html")
                    || path.endsWith("/404")
                    || path.endsWith("/404.html");
        } catch (Exception e) {
            return false;
        }
    }

    private void configureWebViewSettings() {
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setAllowFileAccess(true);
        webView.getSettings().setAllowFileAccessFromFileURLs(true);
        webView.getSettings().setAllowContentAccess(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        webView.getSettings().setSupportMultipleWindows(true);
        webView.getSettings().setJavaScriptCanOpenWindowsAutomatically(true);
        webView.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        webView.getSettings().setAllowUniversalAccessFromFileURLs(true);
        webView.getSettings().setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            webView.getSettings().setOffscreenPreRaster(true); // pre-render to shorten visible load time
        }
    }

    private void restoreLocalStorageSnapshot(String snapshot) {
        if (webView == null) return;
        if (snapshot == null || snapshot.isEmpty()) return;
        String base64 = Base64.encodeToString(snapshot.getBytes(), Base64.NO_WRAP);
        final String script = "(function(){try{var json=decodeURIComponent(escape(atob('" + base64 + "')));"
                + "var data=JSON.parse(json);localStorage.clear();"
                + "Object.keys(data).forEach(function(k){localStorage.setItem(k,data[k]);});return 'ok';}"
                + "catch(e){return 'error';}})();";
        webView.evaluateJavascript(script, value -> webView.post(webView::reload));
    }

    private void ensureLegacyStoragePermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) return;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;
        if (ActivityCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE)
                == PackageManager.PERMISSION_GRANTED) {
            return;
        }
        ActivityCompat.requestPermissions(this, new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, 1001);
    }

    private String guessMimeType(Uri uri) {
        String extension = MimeTypeMap.getFileExtensionFromUrl(uri.toString());
        if (extension == null) return null;
        extension = extension.toLowerCase(Locale.ROOT);
        String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
        if (mime != null) return mime;
        if (extension.equals("svg")) return "image/svg+xml";
        if (extension.equals("ogg")) return "audio/ogg";
        if (extension.equals("woff")) return "font/woff";
        if (extension.equals("woff2")) return "font/woff2";
        if (extension.equals("ttf")) return "font/ttf";
        if (extension.equals("otf")) return "font/otf";
        return null;
    }

    private WebResourceResponse interceptAssetRequest(Uri uri) {
        if (uri == null) return null;
        if (!"file".equalsIgnoreCase(uri.getScheme())) return null;
        String path = uri.getPath();
        if (path == null || !path.startsWith("/android_asset/assets/")) return null;
        try {
            String assetPath = path.substring("/android_asset/".length());
            String mime = resolveMimeType(uri, null);
            Map<String, String> headers = new HashMap<>();
            headers.put("Access-Control-Allow-Origin", "*");
            return new WebResourceResponse(mime, null, 200, "OK", headers, getAssets().open(assetPath));
        } catch (Exception e) {
            return null;
        }
    }

    private String resolveMimeType(Uri uri, String mimeFromHeader) {
        if (mimeFromHeader != null && !mimeFromHeader.isEmpty()) {
            int semicolon = mimeFromHeader.indexOf(';');
            if (semicolon > 0) {
                return mimeFromHeader.substring(0, semicolon).trim();
            }
            return mimeFromHeader.trim();
        }
        String guessed = guessMimeType(uri);
        return guessed != null ? guessed : "application/octet-stream";
    }

    private void exportLocalStorageSnapshot() {
        if (webView == null) return;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.KITKAT) return; // evaluateJavascript requires 19+

        final String script =
                "(function(){try{const o={};for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);o[k]=localStorage.getItem(k);}const json=JSON.stringify(o);return btoa(unescape(encodeURIComponent(json)));}catch(e){return '';} })();";

        webView.evaluateJavascript(script, value -> {
            try {
                String decodedJsString = (String) new JSONTokener(value).nextValue();
                if (decodedJsString == null || decodedJsString.isEmpty()) return;
                byte[] data = android.util.Base64.decode(decodedJsString, android.util.Base64.DEFAULT);
                storageExporter.saveLocalStorageSnapshot(new String(data));
            } catch (Exception e) {
                // ignore
            }
        });
    }
}
