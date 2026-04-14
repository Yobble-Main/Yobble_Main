plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
}

val androidKeystorePath = providers.environmentVariable("ANDROID_KEYSTORE_PATH")
    .orElse(providers.gradleProperty("ANDROID_KEYSTORE_PATH"))
val androidKeystorePassword = providers.environmentVariable("ANDROID_KEYSTORE_PASSWORD")
    .orElse(providers.gradleProperty("ANDROID_KEYSTORE_PASSWORD"))
val androidKeyAlias = providers.environmentVariable("ANDROID_KEY_ALIAS")
    .orElse(providers.gradleProperty("ANDROID_KEY_ALIAS"))
val androidKeyPassword = providers.environmentVariable("ANDROID_KEY_PASSWORD")
    .orElse(providers.gradleProperty("ANDROID_KEY_PASSWORD"))

val hasReleaseSigning = androidKeystorePath.isPresent
        && androidKeystorePassword.isPresent
        && androidKeyAlias.isPresent
        && androidKeyPassword.isPresent

android {
    namespace = "com.Benno111.dorfplatformertimetravel"
    compileSdk {
        version = release(36)
    }

    defaultConfig {
        applicationId = "com.yobble.client"
        minSdk = 21
        targetSdk = 36
        versionCode = 1
        versionName = "0.0.02"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        proguardFiles("proguard-rules.pro")
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = file(androidKeystorePath.get())
                storePassword = androidKeystorePassword.get()
                keyAlias = androidKeyAlias.get()
                keyPassword = androidKeyPassword.get()
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            // Run ProGuard/R8 in debug too so every build path is guarded
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.constraintlayout)
    implementation(libs.androidx.navigation.fragment)
    implementation(libs.androidx.navigation.ui)
    implementation(libs.androidx.webkit)
    testImplementation(libs.junit)
    androidTestImplementation(libs.androidx.junit)
    androidTestImplementation(libs.androidx.espresso.core)
}
