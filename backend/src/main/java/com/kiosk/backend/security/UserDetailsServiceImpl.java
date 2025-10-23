package com.kiosk.backend.security;

import com.kiosk.backend.entity.User;
import com.kiosk.backend.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.Collections;

@Service
@RequiredArgsConstructor
public class UserDetailsServiceImpl implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new UsernameNotFoundException("User not found with email: " + email));

        // Check user status and return UserDetails with enabled flag
        boolean accountEnabled = (user.getStatus() == User.UserStatus.ACTIVE);
        boolean accountNonLocked = (user.getStatus() != User.UserStatus.SUSPENDED);

        return new org.springframework.security.core.userdetails.User(
                user.getEmail(),
                user.getPassword(),
                accountEnabled,  // enabled
                true,            // accountNonExpired
                true,            // credentialsNonExpired
                accountNonLocked, // accountNonLocked
                getAuthorities(user)
        );
    }

    private Collection<? extends GrantedAuthority> getAuthorities(User user) {
        return Collections.singletonList(new SimpleGrantedAuthority("ROLE_" + user.getRole().name()));
    }
}
