package com.kiosk.backend.security;

import com.kiosk.backend.entity.User;
import com.kiosk.backend.repository.UserRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final UserDetailsService userDetailsService;
    private final UserRepository userRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        try {
            String jwt = getJwtFromRequest(request);

            if (StringUtils.hasText(jwt) && tokenProvider.validateToken(jwt)) {
                String userEmail = tokenProvider.getUserEmailFromToken(jwt);

                // Check token version to invalidate old tokens
                Long tokenVersion = tokenProvider.getTokenVersionFromToken(jwt);

                // Get user from database to check current token version
                Optional<User> userOpt = userRepository.findByEmail(userEmail);
                if (userOpt.isPresent()) {
                    User user = userOpt.get();

                    // If token has no version (old token) or version doesn't match, reject it
                    if (tokenVersion == null) {
                        log.warn("Token without version detected for user: {}. Token will be rejected.", userEmail);
                        // Don't authenticate - old token format
                    } else if (!tokenVersion.equals(user.getTokenVersion())) {
                        log.warn("Token version mismatch for user: {}. Expected: {}, Got: {}",
                                userEmail, user.getTokenVersion(), tokenVersion);
                        // Don't authenticate - token has been invalidated by new login
                    } else {
                        // Token is valid and version matches
                        UserDetails userDetails = userDetailsService.loadUserByUsername(userEmail);
                        UsernamePasswordAuthenticationToken authentication =
                                new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));

                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    }
                }
            }
        } catch (Exception ex) {
            log.error("Could not set user authentication in security context", ex);
        }

        filterChain.doFilter(request, response);
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String bearerToken = request.getHeader("Authorization");
        if (StringUtils.hasText(bearerToken) && bearerToken.startsWith("Bearer ")) {
            return bearerToken.substring(7);
        }
        return null;
    }
}
