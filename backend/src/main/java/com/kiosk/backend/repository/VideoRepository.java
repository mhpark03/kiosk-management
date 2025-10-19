package com.kiosk.backend.repository;

import com.kiosk.backend.entity.Video;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VideoRepository extends JpaRepository<Video, Long> {
    List<Video> findByUploadedByOrderByUploadedAtDesc(String uploadedBy);
    List<Video> findAllByOrderByUploadedAtDesc();
}
