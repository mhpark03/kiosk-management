package com.kiosk.backend.repository;

import com.kiosk.backend.entity.Store;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface StoreRepository extends JpaRepository<Store, Long> {

    Optional<Store> findByPosid(String posid);

    Boolean existsByPosid(String posid);

    // Get all stores including deleted ones
    List<Store> findAllByOrderByRegdateDesc();

    // Get only active stores
    @Query("SELECT s FROM Store s WHERE s.deldate IS NULL ORDER BY s.regdate DESC")
    List<Store> findActiveStores();

    // Get max posid for generating next sequential ID
    @Query("SELECT MAX(s.posid) FROM Store s")
    String findMaxPosid();
}
