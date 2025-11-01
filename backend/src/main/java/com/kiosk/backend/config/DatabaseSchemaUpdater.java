package com.kiosk.backend.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.JdbcTemplate;

@Configuration
@Slf4j
public class DatabaseSchemaUpdater {

    @Bean
    public CommandLineRunner updateDatabaseSchema(JdbcTemplate jdbcTemplate) {
        return args -> {
            try {
                log.info("Updating database schema for new enum values...");

                // Update video_type column to VARCHAR to support AI_GENERATED
                jdbcTemplate.execute("ALTER TABLE videos MODIFY COLUMN video_type VARCHAR(20) NOT NULL");
                log.info("✅ Updated video_type column to VARCHAR(20)");

                // Update media_type column to VARCHAR to support AUDIO
                jdbcTemplate.execute("ALTER TABLE videos MODIFY COLUMN media_type VARCHAR(20) NOT NULL");
                log.info("✅ Updated media_type column to VARCHAR(20)");

            } catch (Exception e) {
                // Ignore errors if columns are already VARCHAR or if update is not needed
                log.warn("Schema update warning (may be expected if already updated): {}", e.getMessage());
            }
        };
    }
}
