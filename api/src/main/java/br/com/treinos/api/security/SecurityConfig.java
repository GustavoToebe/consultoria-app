package br.com.treinos.api.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;
import java.util.Set;

/**
 * Desenho da Central (seção 5 do plano): sem sessão no servidor, JWT no header, refresh em cookie HttpOnly na web
 * (com CSRF) ou no corpo no app nativo. Toda rota fora da lista pública exige login e, no controller,
 * {@code @PreAuthorize} com o papel (o {@code ArquiteturaTest} confere).
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@EnableConfigurationProperties(SecurityProperties.class)
public class SecurityConfig {

    /** Nome próprio, como a Central ({@code CENTRAL-XSRF-TOKEN}), para não colidir com outro app no navegador. */
    public static final String COOKIE_CSRF = "TREINOS-XSRF-TOKEN";

    private static final Set<String> METODOS_SEGUROS = Set.of("GET", "HEAD", "TRACE", "OPTIONS");

    private static final String[] ROTAS_PUBLICAS_POST = {
            "/publico/convites-equipe/*", "/auth/login", "/auth/refresh", "/auth/logout", "/auth/cadastro-treinador"};

    private static final String[] ROTAS_PUBLICAS = {"/publico/**", "/actuator/health", "/error"};

    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource(SecurityProperties properties) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(properties.cors().allowedOrigins());
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-XSRF-TOKEN", "X-Request-Id",
                DestinoCliente.HEADER));
        configuration.setExposedHeaders(List.of("X-Request-Id", "Retry-After"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http,
                                                   JwtAuthenticationFilter jwtAuthenticationFilter,
                                                   CorsConfigurationSource corsConfigurationSource,
                                                   RestAuthenticationEntryPoint authenticationEntryPoint,
                                                   RestAccessDeniedHandler accessDeniedHandler) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(csrf -> csrf
                        .spa()
                        .csrfTokenRepository(csrfTokenRepository())
                        .requireCsrfProtectionMatcher(SecurityConfig::exigeCsrf))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, ROTAS_PUBLICAS_POST).permitAll()
                        .requestMatchers(ROTAS_PUBLICAS).permitAll()
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }

    /** Mesmo repositório do {@code spa()} (cookie legível pelo JS do app web), com nome próprio. */
    static CookieCsrfTokenRepository csrfTokenRepository() {
        CookieCsrfTokenRepository repositorio = CookieCsrfTokenRepository.withHttpOnlyFalse();
        repositorio.setCookieName(COOKIE_CSRF);
        repositorio.setCookiePath("/");
        return repositorio;
    }

    /**
     * CSRF só protege quem tem o cookie de refresh (cliente web): {@code /auth/refresh} e {@code /auth/logout} com o
     * cookie, e requisição sem Bearer que carregue o cookie. Bearer dispensa (o navegador não o anexa sozinho).
     * Login, cadastro e convite públicos não usam o cookie (como {@code /auth/login} na Central).
     */
    static boolean exigeCsrf(HttpServletRequest request) {
        if (METODOS_SEGUROS.contains(request.getMethod())) {
            return false;
        }
        String caminho = request.getRequestURI().substring(request.getContextPath().length());
        if ("/auth/login".equals(caminho) || "/auth/cadastro-treinador".equals(caminho)
                || caminho.startsWith("/publico/")) {
            return false;
        }
        if (caminho.startsWith("/auth/")) {
            return CookieDeRefresh.presente(request);
        }
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return false;
        }
        return CookieDeRefresh.presente(request);
    }
}
