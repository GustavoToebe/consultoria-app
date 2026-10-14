package br.com.treinos.api.security;

import br.com.plataforma.comum.web.UnauthorizedException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.UUID;

/**
 * Access token HS256 de 15 minutos (como a Central). Claims: {@code sub} (usuário), {@code purpose=access}, {@code cv}
 * (versão das credenciais) e {@code papel}. Sem dado pessoal. A autorização usa o usuário do banco, não o papel do
 * token: o claim é só informativo para o app.
 */
@Service
public class JwtService {

    static final String CLAIM_PURPOSE = "purpose";
    static final String PURPOSE_ACCESS = "access";
    static final String CLAIM_VERSAO = "cv";
    static final String CLAIM_PAPEL = "papel";

    private final SecretKey key;
    private final SecurityProperties.Jwt config;

    public JwtService(SecurityProperties properties) {
        this.config = properties.jwt();
        if (config == null || config.secret() == null || config.secret().isBlank()) {
            throw new IllegalStateException("TREINOS_JWT_SEGREDO não definido.");
        }
        byte[] secretBytes;
        try {
            secretBytes = Base64.getDecoder().decode(config.secret().trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("TREINOS_JWT_SEGREDO precisa ser Base64 válido.", e);
        }
        if (secretBytes.length < 32) {
            throw new IllegalStateException("TREINOS_JWT_SEGREDO precisa decodificar para pelo menos 32 bytes.");
        }
        this.key = Keys.hmacShaKeyFor(secretBytes);
    }

    public String gerarAccessToken(UUID usuarioId, long credenciaisVersao, String papel) {
        Instant agora = Instant.now();
        return Jwts.builder()
                .subject(usuarioId.toString())
                .claim(CLAIM_PURPOSE, PURPOSE_ACCESS)
                .claim(CLAIM_VERSAO, credenciaisVersao)
                .claim(CLAIM_PAPEL, papel)
                .issuedAt(Date.from(agora))
                .expiration(Date.from(agora.plus(config.accessTokenTtl())))
                .signWith(key)
                .compact();
    }

    public long expiresInSeconds() {
        return config.accessTokenTtl().toSeconds();
    }

    public Acesso validarAcesso(String token) {
        try {
            Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
            if (!PURPOSE_ACCESS.equals(claims.get(CLAIM_PURPOSE))) {
                throw recusado();
            }
            if (!(claims.get(CLAIM_VERSAO) instanceof Number versao)) {
                throw recusado();
            }
            return new Acesso(UUID.fromString(claims.getSubject()), versao.longValue());
        } catch (JwtException | IllegalArgumentException e) {
            throw recusado();
        }
    }

    private static UnauthorizedException recusado() {
        return new UnauthorizedException("Token recusado.", "SESSAO_EXPIRADA");
    }

    public record Acesso(UUID usuarioId, long credenciaisVersao) {
    }
}
