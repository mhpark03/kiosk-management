package com.kiosk.backend.repository;

import com.kiosk.backend.entity.Kiosk;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KioskRepository extends JpaRepository<Kiosk, Long> {

    Optional<Kiosk> findByKioskid(String kioskid);

    Boolean existsByKioskid(String kioskid);

    List<Kiosk> findByPosid(String posid);

    // Find kiosk by posid and kioskno
    @Query("SELECT k FROM Kiosk k WHERE k.posid = :posid AND k.kioskno = :kioskno AND k.state != 'DELETED'")
    Optional<Kiosk> findByPosidAndKioskno(@Param("posid") String posid, @Param("kioskno") Integer kioskno);

    // Check duplicate for posid + kioskno (excluding specific kiosk ID for edit operation)
    @Query("SELECT COUNT(k) > 0 FROM Kiosk k WHERE k.posid = :posid AND k.kioskno = :kioskno AND k.state != 'DELETED' AND k.id != :excludeId")
    Boolean existsByPosidAndKiosknoExcludingId(@Param("posid") String posid, @Param("kioskno") Integer kioskno, @Param("excludeId") Long excludeId);

    // Get max kioskid for generating next sequential ID
    @Query("SELECT MAX(k.kioskid) FROM Kiosk k")
    String findMaxKioskid();

    // Get max kioskno for specific store (including deleted ones)
    @Query("SELECT MAX(k.kioskno) FROM Kiosk k WHERE k.posid = :posid")
    Integer findMaxKiosknoByPosid(@Param("posid") String posid);

    // Get all kiosks including deleted ones
    List<Kiosk> findAllByOrderByRegdateDesc();

    // Get only active kiosks (not deleted)
    @Query("SELECT k FROM Kiosk k WHERE k.state != 'DELETED' ORDER BY k.regdate DESC")
    List<Kiosk> findActiveKiosks();

    // Filter kiosks by store and/or maker
    @Query("SELECT k FROM Kiosk k WHERE " +
           "(:posid IS NULL OR k.posid = :posid) AND " +
           "(:maker IS NULL OR k.maker = :maker) AND " +
           "(:includeDeleted = true OR k.state != 'DELETED') " +
           "ORDER BY k.regdate DESC")
    List<Kiosk> findKiosksByFilter(
        @Param("posid") String posid,
        @Param("maker") String maker,
        @Param("includeDeleted") Boolean includeDeleted
    );
}
