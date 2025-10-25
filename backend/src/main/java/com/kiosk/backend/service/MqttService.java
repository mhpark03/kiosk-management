package com.kiosk.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.integration.mqtt.support.MqttHeaders;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class MqttService {

    private final MessageChannel mqttOutboundChannel;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${mqtt.topics.config-update}")
    private String configUpdateTopicTemplate;

    @Value("${mqtt.topics.video-update}")
    private String videoUpdateTopicTemplate;

    /**
     * 키오스크 설정 업데이트 알림 전송
     * @param kioskid 키오스크 ID
     */
    public void notifyConfigUpdate(String kioskid) {
        try {
            String topic = configUpdateTopicTemplate.replace("{kioskid}", kioskid);

            // 메시지 페이로드 구성
            String payload = objectMapper.writeValueAsString(new ConfigUpdateMessage(
                    kioskid,
                    "CONFIG_UPDATED",
                    System.currentTimeMillis()
            ));

            Message<String> message = MessageBuilder
                    .withPayload(payload)
                    .setHeader(MqttHeaders.TOPIC, topic)
                    .setHeader(MqttHeaders.QOS, 1) // QoS 1 - At least once
                    .setHeader(MqttHeaders.RETAINED, true) // Retained message
                    .build();

            mqttOutboundChannel.send(message);

            log.info("MQTT config update notification sent to topic: {} for kioskid: {}", topic, kioskid);

        } catch (Exception e) {
            log.error("Failed to send MQTT config update notification for kioskid: {}", kioskid, e);
        }
    }

    /**
     * 영상 할당 업데이트 알림 전송
     * @param kioskid 키오스크 ID
     */
    public void notifyVideoUpdate(String kioskid) {
        try {
            String topic = videoUpdateTopicTemplate.replace("{kioskid}", kioskid);

            String payload = objectMapper.writeValueAsString(new VideoUpdateMessage(
                    kioskid,
                    "VIDEO_UPDATED",
                    System.currentTimeMillis()
            ));

            Message<String> message = MessageBuilder
                    .withPayload(payload)
                    .setHeader(MqttHeaders.TOPIC, topic)
                    .setHeader(MqttHeaders.QOS, 1)
                    .setHeader(MqttHeaders.RETAINED, true)
                    .build();

            mqttOutboundChannel.send(message);

            log.info("MQTT video update notification sent to topic: {} for kioskid: {}", topic, kioskid);

        } catch (Exception e) {
            log.error("Failed to send MQTT video update notification for kioskid: {}", kioskid, e);
        }
    }

    /**
     * 사용자 정의 메시지 전송
     * @param topic MQTT 토픽
     * @param payload 메시지 내용
     */
    public void publish(String topic, String payload) {
        try {
            Message<String> message = MessageBuilder
                    .withPayload(payload)
                    .setHeader(MqttHeaders.TOPIC, topic)
                    .setHeader(MqttHeaders.QOS, 1)
                    .build();

            mqttOutboundChannel.send(message);

            log.info("MQTT message sent to topic: {}", topic);

        } catch (Exception e) {
            log.error("Failed to send MQTT message to topic: {}", topic, e);
        }
    }

    // DTO classes for MQTT messages
    private record ConfigUpdateMessage(String kioskid, String type, long timestamp) {}
    private record VideoUpdateMessage(String kioskid, String type, long timestamp) {}
}
