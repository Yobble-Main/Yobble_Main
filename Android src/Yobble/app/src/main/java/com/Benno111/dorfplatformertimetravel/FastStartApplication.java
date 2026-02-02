package com.Benno111.dorfplatformertimetravel;

import android.app.Application;

public class FastStartApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        GameWebViewHolder.get(this).warmUpAsync();
    }
}
