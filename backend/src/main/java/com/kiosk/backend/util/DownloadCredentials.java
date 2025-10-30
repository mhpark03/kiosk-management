package com.kiosk.backend.util;

import com.kiosk.backend.service.S3Service;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

import java.io.FileOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@SpringBootApplication
@ComponentScan(basePackages = "com.kiosk.backend")
public class DownloadCredentials implements CommandLineRunner {

    private final S3Service s3Service;

    public DownloadCredentials(S3Service s3Service) {
        this.s3Service = s3Service;
    }

    public static void main(String[] args) {
        SpringApplication.run(DownloadCredentials.class, args);
    }

    @Override
    public void run(String... args) throws Exception {
        String s3Key = "credentials/google-tts-service-account.json";
        String localPath = "google-tts-credentials.json";

        System.out.println("Downloading from S3: " + s3Key);

        try {
            // Download from S3
            byte[] credentials = s3Service.downloadFile(s3Key);

            System.out.println("Downloaded " + credentials.length + " bytes");

            // Save to local file
            Path filePath = Paths.get(localPath);
            Files.write(filePath, credentials);

            System.out.println("Saved to: " + filePath.toAbsolutePath());
            System.out.println("\nTo use this file, set the environment variable:");
            System.out.println("GOOGLE_APPLICATION_CREDENTIALS=" + filePath.toAbsolutePath());
            System.out.println("\nOr update application.yml:");
            System.out.println("google:");
            System.out.println("  tts:");
            System.out.println("    credentials:");
            System.out.println("      file: " + filePath.toAbsolutePath());

            System.exit(0);
        } catch (Exception e) {
            System.err.println("Failed to download credentials: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
