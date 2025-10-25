package com.kiosk.backend.config;

import com.kiosk.backend.security.JwtAuthenticationFilter;
import com.kiosk.backend.security.KioskAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableWebSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final KioskAuthenticationFilter kioskAuthenticationFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // Disable CSRF for REST API
            .csrf(csrf -> csrf.disable())

            // Configure CORS
            .cors(cors -> cors.configurationSource(new CorsConfig().corsConfigurationSource()))

            // Configure session management (stateless for REST API)
            .sessionManagement(session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))

            // Configure authorization
            .authorizeHttpRequests(auth -> auth
                // Public endpoints - authentication not required
                .requestMatchers("/api/auth/login", "/api/auth/signup", "/api/auth/reset-password").permitAll()
                // H2 Console (for development/testing only - REMOVE IN PRODUCTION!)
                .requestMatchers("/h2-console/**").permitAll()
                // Swagger/OpenAPI endpoints
                .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()
                // Actuator endpoints (for AWS health checks)
                .requestMatchers("/actuator/health", "/actuator/info").permitAll()
                // WebSocket endpoints
                .requestMatchers("/ws/**").permitAll()
                // Kiosk initial lookup - no auth needed (to get posid/kioskno)
                .requestMatchers("/api/kiosks/kioskid/*").permitAll()
                // Kiosk events - no auth needed (kiosk apps can log events freely)
                .requestMatchers("/api/kiosk-events", "/api/kiosk-events/**").permitAll()
                // Kiosk video management - requires kiosk authentication (via headers)
                .requestMatchers("/api/kiosks/*/videos-with-status").authenticated()
                .requestMatchers("/api/kiosks/*/videos/*/status").authenticated()
                .requestMatchers("/api/kiosks/by-kioskid/*/videos-with-status").authenticated()
                .requestMatchers("/api/kiosks/by-kioskid/*/videos/*/status").authenticated()
                // Kiosk configuration management - requires kiosk authentication
                .requestMatchers("/api/kiosks/by-kioskid/*/config").authenticated()
                .requestMatchers("/api/videos/*").authenticated()
                // Runway API endpoints - requires authentication
                .requestMatchers("/api/runway/**").authenticated()
                // All other endpoints require authentication
                .requestMatchers("/api/**").authenticated()
                .anyRequest().authenticated()
            )

            // Allow H2 Console to be embedded in frames
            .headers(headers -> headers.frameOptions(frame -> frame.sameOrigin()))

            // Add Kiosk authentication filter (checks for kiosk headers first)
            .addFilterBefore(kioskAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
            // Add JWT authentication filter
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authConfig) throws Exception {
        return authConfig.getAuthenticationManager();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
