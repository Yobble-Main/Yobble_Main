package com.Benno111.dorfplatformertimetravel;

import android.content.Context;
import android.os.Environment;
import android.util.Base64;

import java.security.MessageDigest;
import java.security.SecureRandom;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileInputStream;
import java.io.ByteArrayOutputStream;

/**
 * Persists local storage snapshots into /Android/media/<package>/Dorfplatformer/local-storage.json
 * so they appear in the system Files app sidebar without special access.
 */
public class StorageExporter {
    private static final String DIRECTORY_NAME = "Dorfplatformer";
    private static final String FILE_NAME = "local-storage.json";
    private static final String ENCRYPTION_KEY = "benno111.games.dorfplatformer.timetravel.config";
    private static final String TRANSFORMATION = "AES/CBC/PKCS5Padding";

    private final Context context;

    public StorageExporter(Context context) {
        this.context = context.getApplicationContext();
    }

    public void saveLocalStorageSnapshot(String json) {
        if (json == null) return;
        String encrypted = encrypt(json);
        if (encrypted == null || encrypted.isEmpty()) return;
        saveToAndroidMedia(encrypted);
    }

    public String readLocalStorageSnapshot() {
        try {
            File mediaRoot = getMediaRoot();
            File inFile = new File(mediaRoot, FILE_NAME);
            if (!inFile.exists()) return null;

            try (FileInputStream in = new FileInputStream(inFile);
                 ByteArrayOutputStream out = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                }
                return decrypt(out.toString());
            }
        } catch (Exception ignored) {
            return null;
        }
    }

    @SuppressWarnings("deprecation") // getExternalStorageDirectory is required to target /Android/media
    private void saveToAndroidMedia(String json) {
        try {
            File mediaRoot = getMediaRoot();
            if (!mediaRoot.exists()) mediaRoot.mkdirs();

            File outFile = new File(mediaRoot, FILE_NAME);
            try (FileOutputStream out = new FileOutputStream(outFile, false)) {
                out.write(json.getBytes());
                out.flush();
            }
        } catch (Exception ignored) {
        }
    }

    @SuppressWarnings("deprecation")
    private File getMediaRoot() {
        String packageName = context.getPackageName();
        return new File(Environment.getExternalStorageDirectory(),
                "Android/media/" + packageName + "/" + DIRECTORY_NAME);
    }

    /**
     * Provides a cache directory under Android/media/<package>/cache for large media.
     */
    @SuppressWarnings("deprecation")
    public static File getExternalMediaCacheDir(Context context) {
        if (context == null) return null;
        String packageName = context.getPackageName();
        File dir = new File(Environment.getExternalStorageDirectory(),
                "Android/media/" + packageName + "/cache");
        if (!dir.exists() && !dir.mkdirs()) {
            return null;
        }
        return dir;
    }

    private String encrypt(String plainText) {
        try {
            byte[] key = deriveKey();
            byte[] iv = new byte[16];
            new SecureRandom().nextBytes(iv);

            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.ENCRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(iv));
            byte[] cipherBytes = cipher.doFinal(plainText.getBytes());

            byte[] combined = new byte[iv.length + cipherBytes.length];
            System.arraycopy(iv, 0, combined, 0, iv.length);
            System.arraycopy(cipherBytes, 0, combined, iv.length, cipherBytes.length);

            return Base64.encodeToString(combined, Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }

    private String decrypt(String encoded) {
        if (encoded == null || encoded.isEmpty()) return null;
        try {
            byte[] combined = Base64.decode(encoded, Base64.DEFAULT);
            if (combined.length < 17) return null;

            byte[] iv = new byte[16];
            byte[] cipherBytes = new byte[combined.length - 16];
            System.arraycopy(combined, 0, iv, 0, 16);
            System.arraycopy(combined, 16, cipherBytes, 0, cipherBytes.length);

            byte[] key = deriveKey();
            Cipher cipher = Cipher.getInstance(TRANSFORMATION);
            cipher.init(Cipher.DECRYPT_MODE, new SecretKeySpec(key, "AES"), new IvParameterSpec(iv));
            byte[] plain = cipher.doFinal(cipherBytes);
            return new String(plain);
        } catch (Exception e) {
            return null;
        }
    }

    private byte[] deriveKey() throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        return digest.digest(ENCRYPTION_KEY.getBytes());
    }
}
