package com.kiosk.backend.repository;

import com.kiosk.backend.entity.Audio;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AudioRepository extends JpaRepository<Audio, Long> {

    List<Audio> findByUploadedById(Long userId);

    List<Audio> findByLanguageCode(String languageCode);

    List<Audio> findAllByOrderByUploadedAtDesc();
}
