package com.kiosk.backend.dto;

import lombok.Data;
import org.springframework.web.multipart.MultipartFile;

@Data
public class RunwayVideoRequest {
    private MultipartFile image1;
    private MultipartFile image2;
    private String prompt;
    private Integer duration = 5;
}
