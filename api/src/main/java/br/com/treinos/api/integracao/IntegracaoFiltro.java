package br.com.treinos.api.integracao;

import br.com.treinos.api.web.CorpoExcedidoException;
import br.com.treinos.api.web.LimiteCorpoFilter;
import br.com.treinos.api.web.RespostaDeErro;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.json.JsonMapper;

import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Autentica as chamadas da Central em {@code /integracao/**} por HMAC (contrato 2.2 a 2.4), sem JWT de usuário, sem
 * cookie e sem sessão. Ordem: chave, janela de horário, formato da assinatura, nonce preenchido, corpo, assinatura e,
 * só com a assinatura válida, o nonce (ninguém lota a tabela sem conhecer o segredo). O corpo só é lido depois das
 * conferências baratas. Não é um bean: nasce dentro da cadeia própria ({@link IntegracaoSecurityConfig}), senão o
 * Spring Boot o registraria também como filtro global.
 */
public class IntegracaoFiltro extends OncePerRequestFilter {

    public static final String CHAVE = "X-Integracao-Chave";
    public static final String TIMESTAMP = "X-Integracao-Timestamp";
    public static final String NONCE = "X-Integracao-Nonce";
    public static final String ASSINATURA = "X-Integracao-Assinatura";
    public static final String AUTORIDADE = "PERM_INTEGRACAO";
    /** Atributo da requisição com o SHA-256 (hex) do corpo recebido: o provisionamento o grava como hash da operação. */
    public static final String ATRIBUTO_HASH_CORPO = IntegracaoFiltro.class.getName() + ".hashCorpo";

    static final long JANELA_SEGUNDOS = 300;
    private static final Pattern FORMATO_ASSINATURA = Pattern.compile("v1=[0-9a-f]{64}");
    private static final Logger LOG = LoggerFactory.getLogger(IntegracaoFiltro.class);

    private final ChavesDeIntegracao chaves;
    private final IntegracaoNonceService nonces;
    private final JsonMapper jsonMapper;

    public IntegracaoFiltro(ChavesDeIntegracao chaves, IntegracaoNonceService nonces, JsonMapper jsonMapper) {
        this.chaves = chaves;
        this.nonces = nonces;
        this.jsonMapper = jsonMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !caminho(request).startsWith("/integracao/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (!chaves.ativa()) {
            recusar(request, response, HttpStatus.SERVICE_UNAVAILABLE, "INTEGRACAO_NAO_CONFIGURADA",
                    "A integração com a central não está configurada.");
            return;
        }
        String chaveId = request.getHeader(CHAVE);
        var chave = chaveId == null ? java.util.Optional.<ChavesDeIntegracao.Chave>empty() : chaves.entrada(chaveId.trim());
        if (chave.isEmpty()) {
            recusar(request, response, HttpStatus.UNAUTHORIZED, "CHAVE_DESCONHECIDA", "Chave de integração desconhecida.");
            return;
        }
        String timestamp = request.getHeader(TIMESTAMP);
        if (!horarioDentroDaJanela(timestamp)) {
            recusar(request, response, HttpStatus.UNAUTHORIZED, "TIMESTAMP_FORA_DA_JANELA", "Horário da chamada fora da janela.");
            return;
        }
        String assinatura = request.getHeader(ASSINATURA);
        if (assinatura == null || !FORMATO_ASSINATURA.matcher(assinatura.trim()).matches()) {
            recusar(request, response, HttpStatus.UNAUTHORIZED, "ASSINATURA_INVALIDA", "Assinatura inválida.");
            return;
        }
        String nonce = request.getHeader(NONCE);
        if (nonce == null || nonce.isBlank() || nonce.length() > 128) {
            recusar(request, response, HttpStatus.UNAUTHORIZED, "NONCE_INVALIDO", "Nonce ausente ou grande demais.");
            return;
        }
        byte[] corpo;
        try {
            corpo = request.getInputStream().readAllBytes();
        } catch (LimiteCorpoFilter.CorpoExcedidoIOException excedido) {
            CorpoExcedidoException erro = new CorpoExcedidoException();
            recusar(request, response, erro.getStatus(), erro.getCodigo(), erro.getMessage());
            return;
        }
        String hashCorpo = HmacAssinatura.sha256Hex(corpo);
        String esperada = HmacAssinatura.assinarComHash(chave.get().segredo(), request.getMethod(), caminhoAssinado(request),
                timestamp.trim(), nonce, hashCorpo);
        if (!HmacAssinatura.confere(esperada, assinatura.trim())) {
            recusar(request, response, HttpStatus.UNAUTHORIZED, "ASSINATURA_INVALIDA", "Assinatura inválida.");
            return;
        }
        if (!nonces.registrar(chave.get().id(), nonce)) {
            recusar(request, response, HttpStatus.UNAUTHORIZED, "NONCE_REPETIDO", "Nonce já usado.");
            return;
        }
        request.setAttribute(ATRIBUTO_HASH_CORPO, hashCorpo);
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                "integracao:" + chave.get().id(), null, List.of(new SimpleGrantedAuthority(AUTORIDADE))));
        chain.doFilter(new CorpoCacheado(request, corpo), response);
    }

    /** O que a Central assinou: caminho e query exatamente como vieram na linha de requisição (percent-encoded). */
    private static String caminhoAssinado(HttpServletRequest request) {
        String query = request.getQueryString();
        return request.getRequestURI() + (query == null ? "" : "?" + query);
    }

    private static String caminho(HttpServletRequest request) {
        return request.getRequestURI().substring(request.getContextPath().length());
    }

    private static boolean horarioDentroDaJanela(String timestamp) {
        if (timestamp == null || !timestamp.trim().matches("\\d{1,12}")) {
            return false;
        }
        long segundos = Long.parseLong(timestamp.trim());
        return Math.abs(Instant.now().getEpochSecond() - segundos) <= JANELA_SEGUNDOS;
    }

    /** A resposta só diz o código; o motivo detalhado fica no log (sem segredo, sem corpo). */
    private void recusar(HttpServletRequest request, HttpServletResponse response, HttpStatus status, String codigo,
                         String mensagem) throws IOException {
        LOG.warn("Integração recusada: {} {} -> {}", request.getMethod(), request.getRequestURI(), codigo);
        RespostaDeErro.escrever(response, request, status, mensagem, codigo, jsonMapper);
    }

    /** Devolve o corpo já lido (e conferido) ao controller. */
    private static final class CorpoCacheado extends HttpServletRequestWrapper {

        private final byte[] corpo;

        CorpoCacheado(HttpServletRequest request, byte[] corpo) {
            super(request);
            this.corpo = corpo;
        }

        @Override
        public ServletInputStream getInputStream() {
            ByteArrayInputStream origem = new ByteArrayInputStream(corpo);
            return new ServletInputStream() {
                @Override
                public int read() {
                    return origem.read();
                }

                @Override
                public int read(byte[] destino, int inicio, int tamanho) {
                    return origem.read(destino, inicio, tamanho);
                }

                @Override
                public boolean isFinished() {
                    return origem.available() == 0;
                }

                @Override
                public boolean isReady() {
                    return true;
                }

                @Override
                public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException();
                }
            };
        }

        @Override
        public BufferedReader getReader() {
            String codificacao = getCharacterEncoding();
            Charset charset = codificacao == null ? StandardCharsets.UTF_8 : Charset.forName(codificacao);
            return new BufferedReader(new InputStreamReader(getInputStream(), charset));
        }

        @Override
        public int getContentLength() {
            return corpo.length;
        }

        @Override
        public long getContentLengthLong() {
            return corpo.length;
        }
    }
}
