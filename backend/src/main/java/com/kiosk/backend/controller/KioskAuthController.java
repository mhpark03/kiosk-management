package com.kiosk.backend.controller;

import com.kiosk.backend.dto.KioskTokenRequest;
import com.kiosk.backend.entity.Kiosk;
import com.kiosk.backend.repository.KioskRepository;
import com.kiosk.backend.security.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/kiosk-auth")
@RequiredArgsConstructor
@Slf4j
public class KioskAuthController {

    private final KioskRepository kioskRepository;
    private final JwtTokenProvider jwtTokenProvider;

    /**
     * Generate WebSocket access token for kiosk
     */
    @PostMapping("/token")
    public ResponseEntity<?> generateKioskToken(@RequestBody KioskTokenRequest request) {
        try {
            log.info("Generating kiosk token for kioskId: {}", request.getKioskId());

            // Verify kiosk exists
            Optional<Kiosk> kioskOpt = kioskRepository.findByKioskid(request.getKioskId());
            if (kioskOpt.isEmpty()) {
                return ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .body(Map.of("error", "Kiosk not found"));
            }

            Kiosk kiosk = kioskOpt.get();

            // Verify posId and kioskNo match
            if (!kiosk.getPosid().equals(request.getPosId()) ||
                !kiosk.getKioskno().equals(request.getKioskNo())) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(Map.of("error", "Invalid kiosk credentials"));
            }

            // Generate token with kiosk information
            String token = jwtTokenProvider.generateKioskToken(
                request.getKioskId(),
                request.getPosId(),
                request.getKioskNo()
            );

            Map<String, Object> response = new HashMap<>();
            response.put("accessToken", token);
            response.put("tokenType", "Bearer");
            response.put("kioskId", request.getKioskId());
            response.put("expiresIn", 86400); // 24 hours in seconds

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            log.error("Error generating kiosk token", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(Map.of("error", "Failed to generate token"));
        }
    }
}
