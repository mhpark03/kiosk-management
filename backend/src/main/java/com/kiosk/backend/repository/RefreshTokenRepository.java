package com.kiosk.backend.repository;

import com.kiosk.backend.entity.AppType;
import com.kiosk.backend.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {
    Optional<RefreshToken> findByToken(String token);
    Optional<RefreshToken> findByUserEmail(String userEmail);
    Optional<RefreshToken> findByUserEmailAndAppType(String userEmail, AppType appType);
    void deleteByUserEmail(String userEmail);
    void deleteByUserEmailAndAppType(String userEmail, AppType appType);
}
