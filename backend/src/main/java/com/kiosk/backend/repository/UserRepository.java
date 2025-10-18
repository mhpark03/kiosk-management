package com.kiosk.backend.repository;

import com.kiosk.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    Boolean existsByEmail(String email);

    Boolean existsByRoleAndStatus(User.UserRole role, User.UserStatus status);

    List<User> findByRoleAndStatus(User.UserRole role, User.UserStatus status);
}
