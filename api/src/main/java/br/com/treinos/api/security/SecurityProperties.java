package br.com.treinos.api.security;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/** O JWT, o refresh e o cookie são do módulo de autenticação da plataforma ({@code plataforma.auth.*}). */
@ConfigurationProperties(prefix = "treinos.security")
public record SecurityProperties(Cors cors) {

    public record Cors(List<String> allowedOrigins) {
    }
}
