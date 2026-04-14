package com.Benno111.dorfplatformertimetravel;

import android.app.Activity;
import android.content.Context;
import android.content.MutableContextWrapper;
import android.os.Handler;
import android.os.Looper;
import android.view.ViewGroup;
import android.view.ViewParent;
import android.webkit.WebView;

/**
 * Creates and reuses a single WebView instance so cold-start costs are paid once.
 * The holder swaps the WebView onto the current Activity and parks it on the
 * application context when not visible to avoid leaking Activity references.
 */
public final class GameWebViewHolder {
    private static GameWebViewHolder instance;

    private final Context appContext;
    private final MutableContextWrapper contextWrapper;
    private WebView cachedWebView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private GameWebViewHolder(Context appContext) {
        this.appContext = appContext.getApplicationContext();
        this.contextWrapper = new MutableContextWrapper(this.appContext);
    }

    public static synchronized GameWebViewHolder get(Context context) {
        if (instance == null) {
            instance = new GameWebViewHolder(context.getApplicationContext());
        }
        return instance;
    }

    /** Kick off WebView creation early so the Activity can attach it instantly. */
    public void warmUpAsync() {
        runOnMain(() -> {
            if (cachedWebView != null) return;
            cachedWebView = buildWebView();
            cachedWebView.onPause();
            cachedWebView.pauseTimers();
        });
    }

    /**
     * Returns the cached WebView configured to run inside the given Activity.
     * Must be invoked on the main thread.
     */
    public WebView acquire(Activity activity) {
        if (Looper.myLooper() != Looper.getMainLooper()) {
            throw new IllegalStateException("WebView must be acquired on the main thread");
        }
        if (cachedWebView == null) {
            cachedWebView = buildWebView();
        }
        contextWrapper.setBaseContext(activity);
        detachFromParent(cachedWebView);
        cachedWebView.onResume();
        cachedWebView.resumeTimers();
        return cachedWebView;
    }

    /** Park the WebView on the application context when the Activity is torn down. */
    public void releaseToAppContext() {
        runOnMain(() -> {
            if (cachedWebView == null) return;
            cachedWebView.onPause();
            cachedWebView.pauseTimers();
            detachFromParent(cachedWebView);
            contextWrapper.setBaseContext(appContext);
        });
    }

    private WebView buildWebView() {
        WebView webView = new WebView(contextWrapper);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        return webView;
    }

    private void runOnMain(Runnable runnable) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            runnable.run();
        } else {
            mainHandler.post(runnable);
        }
    }

    private static void detachFromParent(WebView webView) {
        ViewParent parent = webView.getParent();
        if (parent instanceof ViewGroup) {
            ((ViewGroup) parent).removeView(webView);
        }
    }
}
