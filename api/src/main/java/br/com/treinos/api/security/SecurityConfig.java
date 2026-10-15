package br.com.treinos.api.security;

import br.com.plataforma.comum.auth.CookieDeRefresh;
import br.com.plataforma.comum.auth.PoliticaCsrf;
import br.com.plataforma.comum.monitoramento.MonitoramentoFilter;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
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
import org.springframework.security.web.util.matcher.RequestMatcher;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;
import java.util.Set;

/**
 * Desenho da Central: sem sessão no servidor, JWT no header, refresh em cookie HttpOnly na web
 * (com CSRF) ou no corpo no app nativo. Toda rota fora da lista pública exige login e, no controller,
 * {@code @PreAuthorize} com o papel (o {@code ArquiteturaTest} confere).
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@EnableConfigurationProperties(SecurityProperties.class)
public class SecurityConfig {

    private static final Set<String> METODOS_SEGUROS = Set.of("GET", "HEAD", "TRACE", "OPTIONS");

    private static final String[] ROTAS_PUBLICAS_POST = {
            "/publico/convites-equipe/*", "/auth/login", "/auth/refresh", "/auth/logout", "/auth/cadastro-treinador", "/auth/esqueci-senha",
            "/auth/redefinir-senha"};

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
                                                   RestAccessDeniedHandler accessDeniedHandler,
                                                   PoliticaCsrf politicaCsrf, CookieDeRefresh cookieDeRefresh,
                                                   @Value("${monitoramento.token:}") String monitoramentoToken) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource))
                .csrf(csrf -> csrf
                        .csrfTokenRepository(politicaCsrf.repositorio())
                        .csrfTokenRequestHandler(politicaCsrf.tratador())
                        .requireCsrfProtectionMatcher(exigeCsrf(cookieDeRefresh)))
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exceptions -> exceptions
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.POST, ROTAS_PUBLICAS_POST).permitAll()
                        .requestMatchers(ROTAS_PUBLICAS).permitAll()
                        .anyRequest().authenticated())
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class)
                // Credencial exclusiva de coleta (Authorization: Monitoring <token>); só vale em /monitoramento/metrics.
                .addFilterBefore(new MonitoramentoFilter(monitoramentoToken), JwtAuthenticationFilter.class);
        return http.build();
    }

    /**
     * CSRF só protege quem tem o cookie de refresh (cliente web): {@code /auth/refresh} e {@code /auth/logout} com o
     * cookie, e requisição sem Bearer que carregue o cookie. Bearer dispensa (o navegador não o anexa sozinho).
     * Login, cadastro e convite públicos não usam o cookie (como {@code /auth/login} na Central). O cookie e o cabeçalho
     * do token (nome {@code TREINOS-XSRF-TOKEN}) vêm de {@code plataforma.auth.csrf}.
     */
    static RequestMatcher exigeCsrf(CookieDeRefresh cookieDeRefresh) {
        return request -> {
            if (METODOS_SEGUROS.contains(request.getMethod())) {
                return false;
            }
            String caminho = request.getRequestURI().substring(request.getContextPath().length());
            if ("/auth/login".equals(caminho) || "/auth/cadastro-treinador".equals(caminho)
                    || "/auth/esqueci-senha".equals(caminho) || "/auth/redefinir-senha".equals(caminho)
                    || caminho.startsWith("/publico/")) {
                return false;
            }
            if (caminho.startsWith("/auth/")) {
                return cookieDeRefresh.presente(request);
            }
            String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
            if (authorization != null && authorization.regionMatches(true, 0, "Bearer ", 0, 7)) {
                return false;
            }
            return cookieDeRefresh.presente(request);
        };
    }
}
