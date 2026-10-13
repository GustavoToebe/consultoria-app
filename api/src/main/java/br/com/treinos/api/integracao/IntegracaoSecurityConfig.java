package br.com.treinos.api.integracao;

import br.com.treinos.api.security.RestAccessDeniedHandler;
import br.com.treinos.api.security.RestAuthenticationEntryPoint;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import tools.jackson.databind.json.JsonMapper;

/**
 * Cadeia própria de {@code /integracao/**}: sem JWT de usuário, sem CSRF (não usa cookie), sem sessão e sem CORS (é de
 * sistema para sistema). Vem antes da cadeia do app, que termina em {@code anyRequest().authenticated()}. A autoridade
 * {@code PERM_INTEGRACAO} só nasce do filtro HMAC e <b>nunca</b> entra em {@code CatalogoPermissoes}: perfil de acesso
 * total expande o catálogo inteiro.
 */
@Configuration
@EnableConfigurationProperties(IntegracaoProperties.class)
public class IntegracaoSecurityConfig {

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE + 10)
    public SecurityFilterChain integracaoFilterChain(HttpSecurity http, ChavesDeIntegracao chaves,
                                                     IntegracaoNonceService nonces, JsonMapper jsonMapper,
                                                     RestAuthenticationEntryPoint entryPoint,
                                                     RestAccessDeniedHandler accessDenied) throws Exception {
        http
                .securityMatcher("/integracao/**")
                .csrf(csrf -> csrf.disable())
                .cors(cors -> cors.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(e -> e.authenticationEntryPoint(entryPoint).accessDeniedHandler(accessDenied))
                .authorizeHttpRequests(auth -> auth.anyRequest().hasAuthority(IntegracaoFiltro.AUTORIDADE))
                .addFilterBefore(new IntegracaoFiltro(chaves, nonces, jsonMapper), UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
