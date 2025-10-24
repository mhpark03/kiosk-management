package com.kiosk.backend.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class RunwayVideoResponse {
    private boolean success;
    private String videoUrl;
    private String taskId;
    private String status;
    private String message;
}
