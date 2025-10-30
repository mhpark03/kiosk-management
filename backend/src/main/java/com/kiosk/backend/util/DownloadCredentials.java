package com.kiosk.backend.util;

import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Standalone utility to download Google TTS credentials from S3.
 * This is NOT a Spring Boot application - it's a simple utility class.
 *
 * Usage: java -cp backend-0.0.1-SNAPSHOT.jar com.kiosk.backend.util.DownloadCredentials
 */
public class DownloadCredentials {

    public static void main(String[] args) throws Exception {
        String bucketName = System.getenv().getOrDefault("AWS_S3_BUCKET_NAME", "kiosk-video-bucket");
        String s3Key = "credentials/google-tts-service-account.json";
        String localPath = "google-tts-credentials.json";
        String region = System.getenv().getOrDefault("AWS_REGION", "ap-northeast-2");

        System.out.println("Downloading from S3: s3://" + bucketName + "/" + s3Key);

        try {
            // Create S3 client
            S3Client s3Client = S3Client.builder()
                    .region(Region.of(region))
                    .credentialsProvider(DefaultCredentialsProvider.create())
                    .build();

            // Download from S3
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(s3Key)
                    .build();

            ResponseBytes<GetObjectResponse> objectBytes = s3Client.getObjectAsBytes(getObjectRequest);
            byte[] credentials = objectBytes.asByteArray();

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

            s3Client.close();
            System.exit(0);
        } catch (Exception e) {
            System.err.println("Failed to download credentials: " + e.getMessage());
            e.printStackTrace();
            System.exit(1);
        }
    }
}
