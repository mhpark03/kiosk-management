package com.kiosk.backend.repository;

import com.kiosk.backend.entity.KioskVideo;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface KioskVideoRepository extends JpaRepository<KioskVideo, Long> {

    /**
     * Find all videos assigned to a specific kiosk
     */
    List<KioskVideo> findByKioskIdOrderByDisplayOrderAsc(Long kioskId);

    /**
     * Find all kiosks that have a specific video assigned
     */
    List<KioskVideo> findByVideoId(Long videoId);

    /**
     * Delete all video assignments for a specific kiosk
     */
    @Modifying
    @Query("DELETE FROM KioskVideo kv WHERE kv.kioskId = :kioskId")
    void deleteByKioskId(@Param("kioskId") Long kioskId);

    /**
     * Delete all kiosk assignments for a specific video
     */
    @Modifying
    @Query("DELETE FROM KioskVideo kv WHERE kv.videoId = :videoId")
    void deleteByVideoId(@Param("videoId") Long videoId);

    /**
     * Delete a specific kiosk-video assignment
     */
    @Modifying
    @Query("DELETE FROM KioskVideo kv WHERE kv.kioskId = :kioskId AND kv.videoId = :videoId")
    void deleteByKioskIdAndVideoId(@Param("kioskId") Long kioskId, @Param("videoId") Long videoId);

    /**
     * Check if a kiosk-video assignment exists
     */
    boolean existsByKioskIdAndVideoId(Long kioskId, Long videoId);

    /**
     * Find a specific kiosk-video assignment
     */
    KioskVideo findByKioskIdAndVideoId(Long kioskId, Long videoId);
}
