package com.kiosk.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.google.api.gax.core.FixedCredentialsProvider;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.cloud.texttospeech.v1.*;
import com.google.protobuf.ByteString;
import com.kiosk.backend.entity.Audio;
import com.kiosk.backend.repository.AudioRepository;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.FileInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class TtsService {

    @Value("${google.tts.credentials.file:}")
    private String credentialsFilePath;

    private final AudioRepository audioRepository;
    private final S3Service s3Service;

    private static final String AUDIO_TTS_FOLDER = "audio/tts/";
    private static final int MAX_TEXT_LENGTH = 5000;
    private static final int MAX_TITLE_LENGTH = 255;

    private GoogleCredentials credentials;

    @PostConstruct
    public void init() {
        // First, try to load credentials from base64-encoded environment variable (for AWS EB deployment)
        String credentialsBase64 = System.getenv("GOOGLE_CREDENTIALS_BASE64");
        if (credentialsBase64 != null && !credentialsBase64.isEmpty()) {
            try {
                log.info("Loading Google Cloud TTS credentials from GOOGLE_CREDENTIALS_BASE64 environment variable");

                // Decode base64
                byte[] decodedBytes = Base64.getDecoder().decode(credentialsBase64);
                String credentialsJson = new String(decodedBytes, StandardCharsets.UTF_8);

                log.info("Decoded credentials JSON, length: {} bytes", credentialsJson.length());

                try (ByteArrayInputStream credentialsStream =
                        new ByteArrayInputStream(decodedBytes)) {
                    credentials = GoogleCredentials.fromStream(credentialsStream);
                }
                log.info("Google Cloud TTS credentials loaded successfully from base64-encoded environment variable");
                return;
            } catch (Exception e) {
                log.error("Failed to load Google Cloud TTS credentials from base64 environment variable: {}", e.getMessage());
                log.error("Exception details:", e);
                log.warn("TTS service will attempt to use JSON env var, file path or default credentials");
            }
        }

        // Second, try to load credentials from JSON environment variable (primary method)
        String credentialsJson = System.getenv("GOOGLE_CREDENTIALS_JSON");
        if (credentialsJson != null && !credentialsJson.isEmpty()) {
            try {
                log.info("Loading Google Cloud TTS credentials from GOOGLE_CREDENTIALS_JSON environment variable");
                log.info("Credentials JSON length: {} bytes", credentialsJson.length());

                // Use the JSON string directly without any parsing/re-serialization
                // This preserves the exact format including newlines in private_key
                try (ByteArrayInputStream credentialsStream =
                        new ByteArrayInputStream(credentialsJson.getBytes(StandardCharsets.UTF_8))) {
                    credentials = GoogleCredentials.fromStream(credentialsStream);
                }
                log.info("Google Cloud TTS credentials loaded successfully from JSON environment variable");
                return;
            } catch (Exception e) {
                log.error("Failed to load Google Cloud TTS credentials from JSON environment variable: {}", e.getMessage());
                log.error("Full exception:", e);
                log.warn("TTS service will attempt to use file path or default credentials");
            }
        }

        // Third, try to load credentials from file path (for local development)
        if (credentialsFilePath != null && !credentialsFilePath.isEmpty()) {
            try {
                log.info("Loading Google Cloud TTS credentials from file: {}", credentialsFilePath);
                try (FileInputStream serviceAccountStream = new FileInputStream(credentialsFilePath)) {
                    credentials = GoogleCredentials.fromStream(serviceAccountStream);
                }
                log.info("Google Cloud TTS credentials loaded successfully from file");
                return;
            } catch (IOException e) {
                log.error("Failed to load Google Cloud TTS credentials from file: {}", credentialsFilePath, e);
                log.warn("TTS service will attempt to use default credentials");
            }
        }

        // Finally, use default application credentials (GOOGLE_APPLICATION_CREDENTIALS env var)
        log.warn("Google Cloud TTS credentials not configured via JSON env var or file path");
        log.info("Attempting to use default application credentials (GOOGLE_APPLICATION_CREDENTIALS env var)");
    }

    /**
     * Generate audio from text using Google Cloud Text-to-Speech API
     */
    public Audio generateAudio(
            String text,
            String title,
            String description,
            String languageCode,
            String voiceName,
            Audio.VoiceGender gender,
            Double speakingRate,
            Double pitch,
            Long userId
    ) throws IOException {

        // Validate inputs
        if (text == null || text.trim().isEmpty()) {
            throw new IllegalArgumentException("Text is required");
        }
        if (text.length() > MAX_TEXT_LENGTH) {
            throw new IllegalArgumentException("Text is too long. Maximum " + MAX_TEXT_LENGTH + " characters.");
        }
        if (title == null || title.trim().isEmpty()) {
            throw new IllegalArgumentException("Title is required");
        }

        log.info("Generating audio for text (length: {}), voice: {}, language: {}",
            text.length(), voiceName, languageCode);

        Path tempAudioPath = null;

        try {
            // Initialize TTS client with credentials if available
            TextToSpeechClient textToSpeechClient;
            if (credentials != null) {
                TextToSpeechSettings settings = TextToSpeechSettings.newBuilder()
                        .setCredentialsProvider(FixedCredentialsProvider.create(credentials))
                        .build();
                textToSpeechClient = TextToSpeechClient.create(settings);
            } else {
                // Use default credentials
                textToSpeechClient = TextToSpeechClient.create();
            }

            try (textToSpeechClient) {
                // Set the text input to be synthesized
                SynthesisInput input = SynthesisInput.newBuilder()
                        .setText(text)
                        .build();

                // Build the voice request
                VoiceSelectionParams.Builder voiceBuilder = VoiceSelectionParams.newBuilder()
                        .setLanguageCode(languageCode)
                        .setName(voiceName);

                // Set gender
                switch (gender) {
                    case MALE:
                        voiceBuilder.setSsmlGender(SsmlVoiceGender.MALE);
                        break;
                    case FEMALE:
                        voiceBuilder.setSsmlGender(SsmlVoiceGender.FEMALE);
                        break;
                    case NEUTRAL:
                        voiceBuilder.setSsmlGender(SsmlVoiceGender.NEUTRAL);
                        break;
                }

                VoiceSelectionParams voice = voiceBuilder.build();

                // Select the type of audio file
                AudioConfig audioConfig = AudioConfig.newBuilder()
                        .setAudioEncoding(AudioEncoding.MP3)
                        .setSpeakingRate(speakingRate)
                        .setPitch(pitch)
                        .build();

                // Perform the text-to-speech request
                SynthesizeSpeechResponse response = textToSpeechClient.synthesizeSpeech(
                        input, voice, audioConfig);

                // Get the audio contents from the response
                ByteString audioContents = response.getAudioContent();

                // Write to temporary file
                tempAudioPath = Files.createTempFile("tts_", ".mp3");
                Files.write(tempAudioPath, audioContents.toByteArray());

                log.info("Audio generated successfully, size: {} bytes", audioContents.size());

                // Upload to S3
                String filename = "tts_" + UUID.randomUUID().toString() + ".mp3";
                byte[] audioBytes = audioContents.toByteArray();
                String uploadedS3Key = s3Service.uploadBytes(audioBytes, AUDIO_TTS_FOLDER, filename, "audio/mpeg");
                String s3Url = s3Service.getFileUrl(uploadedS3Key);

                log.info("Uploaded audio to S3: {}", uploadedS3Key);

                // Save to database
                Audio audio = Audio.builder()
                        .filename(truncate(filename, MAX_TITLE_LENGTH))
                        .originalFilename(truncate("tts_" + title + ".mp3", MAX_TITLE_LENGTH))
                        .fileSize((long) audioBytes.length)
                        .contentType("audio/mpeg")
                        .s3Key(uploadedS3Key)
                        .s3Url(s3Url)
                        .uploadedById(userId)
                        .title(truncate(title, MAX_TITLE_LENGTH))
                        .description(description)
                        .text(text)
                        .languageCode(languageCode)
                        .voiceName(voiceName)
                        .gender(gender)
                        .speakingRate(speakingRate)
                        .pitch(pitch)
                        .build();

                Audio savedAudio = audioRepository.save(audio);
                log.info("Audio saved to database with ID: {}", savedAudio.getId());

                // Generate presigned URL for immediate playback
                String presignedUrl = s3Service.generatePresignedUrl(uploadedS3Key, 60);
                savedAudio.setS3Url(presignedUrl);

                return savedAudio;
            }

        } finally {
            // Cleanup temporary file
            if (tempAudioPath != null) {
                try {
                    Files.deleteIfExists(tempAudioPath);
                } catch (IOException e) {
                    log.warn("Failed to delete temporary audio file: {}", e.getMessage());
                }
            }
        }
    }

    /**
     * Get all audios with presigned URLs
     */
    public List<Audio> getAllAudios() {
        List<Audio> audios = audioRepository.findAllByOrderByUploadedAtDesc();
        // Generate presigned URLs for S3 access
        for (Audio audio : audios) {
            if (audio.getS3Key() != null && !audio.getS3Key().isEmpty()) {
                String presignedUrl = s3Service.generatePresignedUrl(audio.getS3Key(), 60);
                audio.setS3Url(presignedUrl);
            }
        }
        return audios;
    }

    /**
     * Get audio by ID with presigned URL
     */
    public Audio getAudioById(Long id) {
        Audio audio = audioRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Audio not found with id: " + id));

        // Generate presigned URL for S3 access
        if (audio.getS3Key() != null && !audio.getS3Key().isEmpty()) {
            String presignedUrl = s3Service.generatePresignedUrl(audio.getS3Key(), 60);
            audio.setS3Url(presignedUrl);
        }

        return audio;
    }

    /**
     * Get audios by user with presigned URLs
     */
    public List<Audio> getAudiosByUser(Long userId) {
        List<Audio> audios = audioRepository.findByUploadedById(userId);
        // Generate presigned URLs for S3 access
        for (Audio audio : audios) {
            if (audio.getS3Key() != null && !audio.getS3Key().isEmpty()) {
                String presignedUrl = s3Service.generatePresignedUrl(audio.getS3Key(), 60);
                audio.setS3Url(presignedUrl);
            }
        }
        return audios;
    }

    /**
     * Get audios by language with presigned URLs
     */
    public List<Audio> getAudiosByLanguage(String languageCode) {
        List<Audio> audios = audioRepository.findByLanguageCode(languageCode);
        // Generate presigned URLs for S3 access
        for (Audio audio : audios) {
            if (audio.getS3Key() != null && !audio.getS3Key().isEmpty()) {
                String presignedUrl = s3Service.generatePresignedUrl(audio.getS3Key(), 60);
                audio.setS3Url(presignedUrl);
            }
        }
        return audios;
    }

    /**
     * Delete audio
     */
    public void deleteAudio(Long id) {
        Audio audio = getAudioById(id);

        // Delete from S3
        try {
            s3Service.deleteFile(audio.getS3Key());
            log.info("Deleted audio from S3: {}", audio.getS3Key());
        } catch (Exception e) {
            log.error("Failed to delete audio from S3: {}", e.getMessage());
        }

        // Delete from database
        audioRepository.deleteById(id);
        log.info("Deleted audio from database: {}", id);
    }

    /**
     * Truncate string to maximum length with logging
     */
    private String truncate(String value, int maxLength) {
        if (value == null) {
            return null;
        }
        if (value.length() <= maxLength) {
            return value;
        }
        String truncated = value.substring(0, maxLength);
        log.warn("Truncated value from {} to {} characters: {} -> {}",
                value.length(), maxLength, value, truncated);
        return truncated;
    }
}
