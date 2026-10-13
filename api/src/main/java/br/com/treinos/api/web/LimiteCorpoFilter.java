package br.com.treinos.api.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.util.Locale;

/**
 * Corpo de requisição até 1 MiB, como {@code /integracao/**} na Central. O tamanho declarado é
 * conferido antes da leitura; sem {@code Content-Length} (chunked), a leitura que passa de 1 MiB falha com
 * {@link CorpoExcedidoIOException}, que o {@link GlobalExceptionHandler} traduz em 413. Upload multipart segue os
 * limites próprios do Tomcat ({@code spring.servlet.multipart}).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class LimiteCorpoFilter extends OncePerRequestFilter {

    public static final long LIMITE_BYTES = 1024L * 1024L;

    private final JsonMapper jsonMapper;

    public LimiteCorpoFilter(JsonMapper jsonMapper) {
        this.jsonMapper = jsonMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getContentLengthLong() > LIMITE_BYTES) {
            CorpoExcedidoException erro = new CorpoExcedidoException();
            RespostaDeErro.escrever(response, request, erro.getStatus(), erro.getMessage(), erro.getCodigo(), jsonMapper);
            return;
        }
        String tipo = request.getContentType();
        if (tipo != null && tipo.toLowerCase(Locale.ROOT).startsWith("multipart/")) {
            chain.doFilter(request, response);
            return;
        }
        chain.doFilter(new CorpoLimitado(request), response);
    }

    /** Sinaliza a leitura que passou do limite; vira 413 no handler. */
    public static final class CorpoExcedidoIOException extends IOException {
        private static final long serialVersionUID = 1L;

        CorpoExcedidoIOException() {
            super("Corpo da requisição acima do limite.");
        }
    }

    private static final class CorpoLimitado extends HttpServletRequestWrapper {

        private ServletInputStream limitado;

        CorpoLimitado(HttpServletRequest request) {
            super(request);
        }

        @Override
        public ServletInputStream getInputStream() throws IOException {
            if (limitado == null) {
                limitado = new Contador(super.getInputStream());
            }
            return limitado;
        }
    }

    private static final class Contador extends ServletInputStream {

        private final ServletInputStream origem;
        private long lidos;

        Contador(ServletInputStream origem) {
            this.origem = origem;
        }

        @Override
        public int read() throws IOException {
            int b = origem.read();
            if (b >= 0) {
                somar(1);
            }
            return b;
        }

        @Override
        public int read(byte[] destino, int inicio, int tamanho) throws IOException {
            int n = origem.read(destino, inicio, tamanho);
            if (n > 0) {
                somar(n);
            }
            return n;
        }

        private void somar(int n) throws CorpoExcedidoIOException {
            lidos += n;
            if (lidos > LIMITE_BYTES) {
                throw new CorpoExcedidoIOException();
            }
        }

        @Override
        public boolean isFinished() {
            return origem.isFinished();
        }

        @Override
        public boolean isReady() {
            return origem.isReady();
        }

        @Override
        public void setReadListener(ReadListener listener) {
            origem.setReadListener(listener);
        }
    }
}
