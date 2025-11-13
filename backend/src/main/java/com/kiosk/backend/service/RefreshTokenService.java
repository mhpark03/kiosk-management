package com.kiosk.backend.service;

import com.kiosk.backend.entity.AppType;
import com.kiosk.backend.entity.RefreshToken;
import com.kiosk.backend.repository.RefreshTokenRepository;
import com.kiosk.backend.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class RefreshTokenService {

    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtTokenProvider jwtTokenProvider;

    /**
     * Create a new refresh token for the user and app type
     */
    @Transactional
    public RefreshToken createRefreshToken(String userEmail, AppType appType) {
        // Delete existing refresh token for the user and app type only
        // This allows multiple apps to have separate refresh tokens
        refreshTokenRepository.deleteByUserEmailAndAppType(userEmail, appType);

        // Generate new refresh token
        String token = jwtTokenProvider.generateRefreshToken(userEmail);
        long expirationMs = jwtTokenProvider.getRefreshTokenExpirationMs();
        LocalDateTime expiryDate = LocalDateTime.now().plusSeconds(expirationMs / 1000);

        RefreshToken refreshToken = RefreshToken.builder()
                .token(token)
                .userEmail(userEmail)
                .appType(appType)
                .expiryDate(expiryDate)
                .build();

        RefreshToken saved = refreshTokenRepository.save(refreshToken);
        log.info("Created refresh token for user: {}, appType: {}, expires at: {}",
                 userEmail, appType, expiryDate);
        return saved;
    }

    /**
     * Find refresh token by token string
     */
    @Transactional(readOnly = true)
    public Optional<RefreshToken> findByToken(String token) {
        return refreshTokenRepository.findByToken(token);
    }

    /**
     * Verify refresh token and return if valid
     */
    @Transactional
    public RefreshToken verifyExpiration(RefreshToken token) {
        if (token.isExpired()) {
            refreshTokenRepository.delete(token);
            log.warn("Refresh token expired for user: {}", token.getUserEmail());
            throw new RuntimeException("Refresh token was expired. Please make a new login request");
        }
        return token;
    }

    /**
     * Extend refresh token expiration (7 days from now)
     */
    @Transactional
    public RefreshToken extendExpiration(RefreshToken token) {
        long expirationMs = jwtTokenProvider.getRefreshTokenExpirationMs();
        LocalDateTime newExpiryDate = LocalDateTime.now().plusSeconds(expirationMs / 1000);
        token.setExpiryDate(newExpiryDate);
        RefreshToken updated = refreshTokenRepository.save(token);
        log.info("Extended refresh token expiration for user: {}, new expiry: {}",
                 token.getUserEmail(), newExpiryDate);
        return updated;
    }

    /**
     * Delete refresh token by user email
     */
    @Transactional
    public void deleteByUserEmail(String userEmail) {
        refreshTokenRepository.deleteByUserEmail(userEmail);
        log.info("Deleted refresh token for user: {}", userEmail);
    }

    /**
     * Delete refresh token
     */
    @Transactional
    public void deleteToken(RefreshToken token) {
        refreshTokenRepository.delete(token);
        log.info("Deleted refresh token for user: {}", token.getUserEmail());
    }
}
