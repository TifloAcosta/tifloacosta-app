plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "com.tifloacosta.nativeprototype"
    compileSdk = 36

    defaultConfig {
        // Never use the installed Google Play application's identifier.
        applicationId = when {
            project.findProperty("tifloAudioFocusTest") == "true" ->
                "com.tifloacosta.nativeprototype.audiofocus"
            project.findProperty("tifloScreenLockTest") == "true" ->
                "com.tifloacosta.nativeprototype.screenlock"
            else -> "com.tifloacosta.nativeprototype"
        }
        minSdk = 26
        targetSdk = 35
        versionCode = 21
        versionName = "0.21-pantalla-bloqueada"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        manifestPlaceholders["prototypeLabel"] = when {
            project.findProperty("tifloAudioFocusTest") == "true" ->
                "TifloAcosta Prueba Audio"
            project.findProperty("tifloScreenLockTest") == "true" ->
                "TifloAcosta Prueba Bloqueo"
            else -> "TifloAcosta Nativa Pruebas"
        }
        // Only the separate test APK may be restricted to Pixel arm64.
        if (project.findProperty("tifloArm64Only") == "true") {
            ndk { abiFilters.add("arm64-v8a") }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    buildFeatures {
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2025.08.00")
    implementation(composeBom)
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.activity:activity-compose:1.12.1")
    implementation("com.tom-roush:pdfbox-android:2.0.27.0")
    implementation("org.jsoup:jsoup:1.18.3")
    implementation("androidx.core:core:1.16.0")
    implementation("com.google.mlkit:translate:17.0.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:1.10.2")
    // Legacy OLE2 Office: HSSF (.xls) + HWPF (.doc) + HSLF (.ppt/.pps).
    // API24 compatibility candidate, not production-approved: the
    // historic POI 4.1.2 HMEF/TNEF parser has CVE-2022-26336.
    // Only DOC/XLS/PPT/PPS OLE2 are permitted in NativeReaderLegacyOffice.
    implementation("org.apache.poi:poi:4.1.2") {
        exclude(group = "log4j", module = "log4j")
    }
    implementation("org.apache.poi:poi-scratchpad:4.1.2") {
        exclude(group = "log4j", module = "log4j")
    }
    implementation("org.apache.commons:commons-compress:1.28.0")
    implementation("org.tukaani:xz:1.10")
    implementation("com.github.junrar:junrar:8.1.2")
    // Bundled Latin OCR works offline without a first-run model download.
    implementation("com.google.mlkit:text-recognition:16.0.1")
    implementation("com.google.android.gms:play-services-tasks:18.2.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
    testImplementation("junit:junit:4.13.2")
}
