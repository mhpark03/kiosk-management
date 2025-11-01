package com.kiosk.backend.security;

import com.kiosk.backend.entity.Kiosk;
import com.kiosk.backend.repository.KioskRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class KioskAuthenticationFilter extends OncePerRequestFilter {

    private final KioskRepository kioskRepository;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        // Priority 1: Check for JWT token (Authorization: Bearer)
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.startsWith("Bearer ")) {
            String token = authHeader.substring(7);

            if (authenticateWithJWT(request, token)) {
                filterChain.doFilter(request, response);
                return;
            }
        }

        // Priority 2: Fall back to header-based authentication (legacy support)
        String posId = request.getHeader("X-Kiosk-PosId");
        String kioskId = request.getHeader("X-Kiosk-Id");
        String kioskNoStr = request.getHeader("X-Kiosk-No");

        log.debug("Kiosk Auth Headers - PosId: {}, KioskId: {}, KioskNo: {}", posId, kioskId, kioskNoStr);

        // If kiosk headers are present, try to authenticate
        if (posId != null && kioskId != null && kioskNoStr != null) {
            try {
                Integer kioskNo = Integer.parseInt(kioskNoStr);

                // Verify kiosk exists in database
                Optional<Kiosk> kioskOpt = kioskRepository.findByPosidAndKioskno(posId, kioskNo);

                if (kioskOpt.isPresent()) {
                    Kiosk kiosk = kioskOpt.get();

                    // Verify kioskId matches
                    if (kiosk.getKioskid() != null && kiosk.getKioskid().equals(kioskId)) {
                        log.info("Kiosk authenticated via headers: PosId={}, KioskId={}, KioskNo={}", posId, kioskId, kioskNo);

                        // Create authentication token for kiosk
                        UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                                "KIOSK_" + kioskId,
                                null,
                                Collections.singletonList(new SimpleGrantedAuthority("ROLE_KIOSK"))
                        );
                        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                        // Set authentication in security context
                        SecurityContextHolder.getContext().setAuthentication(authToken);
                    } else {
                        log.warn("Kiosk authentication failed: KioskId mismatch. Expected: {}, Got: {}",
                                kiosk.getKioskid(), kioskId);
                    }
                } else {
                    log.warn("Kiosk authentication failed: Kiosk not found for PosId={}, KioskNo={}", posId, kioskNo);
                }
            } catch (NumberFormatException e) {
                log.error("Invalid KioskNo format: {}", kioskNoStr);
            }
        }

        filterChain.doFilter(request, response);
    }

    /**
     * Authenticate kiosk using JWT token with sessionVersion validation
     */
    private boolean authenticateWithJWT(HttpServletRequest request, String token) {
        try {
            // Validate token signature and expiration
            if (!jwtTokenProvider.validateToken(token)) {
                log.warn("Kiosk JWT validation failed: Invalid or expired token");
                return false;
            }

            // Extract kiosk information from token
            String kioskId = jwtTokenProvider.getKioskIdFromToken(token);
            Long tokenSessionVersion = jwtTokenProvider.getKioskSessionVersionFromToken(token);

            if (kioskId == null) {
                log.warn("Kiosk JWT validation failed: No kioskId in token");
                return false;
            }

            // For legacy tokens without sessionVersion, allow authentication
            if (tokenSessionVersion == null) {
                log.debug("Kiosk JWT: Legacy token without sessionVersion for kioskId={}", kioskId);
                return authenticateKiosk(request, kioskId);
            }

            // Verify sessionVersion matches database
            Optional<Kiosk> kioskOpt = kioskRepository.findByKioskid(kioskId);
            if (kioskOpt.isEmpty()) {
                log.warn("Kiosk JWT validation failed: Kiosk not found for kioskId={}", kioskId);
                return false;
            }

            Kiosk kiosk = kioskOpt.get();
            Long dbSessionVersion = kiosk.getSessionVersion();

            if (!tokenSessionVersion.equals(dbSessionVersion)) {
                log.warn("Kiosk JWT validation failed: SessionVersion mismatch for kioskId={}. Token version: {}, DB version: {}",
                        kioskId, tokenSessionVersion, dbSessionVersion);
                return false;
            }

            log.info("Kiosk authenticated via JWT: kioskId={}, sessionVersion={}", kioskId, tokenSessionVersion);
            return authenticateKiosk(request, kioskId);

        } catch (Exception e) {
            log.error("Kiosk JWT authentication error: {}", e.getMessage());
            return false;
        }
    }

    /**
     * Set authentication in security context
     */
    private boolean authenticateKiosk(HttpServletRequest request, String kioskId) {
        UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                "KIOSK_" + kioskId,
                null,
                Collections.singletonList(new SimpleGrantedAuthority("ROLE_KIOSK"))
        );
        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
        SecurityContextHolder.getContext().setAuthentication(authToken);
        return true;
    }
}
