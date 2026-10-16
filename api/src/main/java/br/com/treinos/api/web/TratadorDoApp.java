package br.com.treinos.api.web;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ApiException;
import br.com.plataforma.comum.web.RequestIdFilter;
import br.com.treinos.api.conta.PlanoException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.List;

/**
 * Os erros do app que o tratador da biblioteca não conhece: o 422 com a lista de problemas em {@code fieldErrors},
 * o 409/403 do plano (recurso em {@code fieldErrors}) e o 429 com {@code Retry-After}. Vem antes do tratador da biblioteca, que cuida de todo o resto.
 */
@RestControllerAdvice
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TratadorDoApp {

    private static final Logger log = LoggerFactory.getLogger(TratadorDoApp.class);

    @ExceptionHandler(ValidacaoException.class)
    public ResponseEntity<ApiError> validacao(ValidacaoException ex, HttpServletRequest request) {
        log.warn("Erro de negócio tratado: status={} codigo={}", ex.getStatus().value(), ex.getCodigo());
        return ResponseEntity.status(ex.getStatus()).body(corpo(ex, request, ex.getProblemas()));
    }

    @ExceptionHandler(PlanoException.class)
    public ResponseEntity<ApiError> plano(PlanoException ex, HttpServletRequest request) {
        log.warn("Erro de negócio tratado: status={} codigo={}", ex.getStatus().value(), ex.getCodigo());
        return ResponseEntity.status(ex.getStatus()).body(corpo(ex, request, ex.getProblemas()));
    }

    @ExceptionHandler(MuitasRequisicoesException.class)
    public ResponseEntity<ApiError> muitasRequisicoes(MuitasRequisicoesException ex, HttpServletRequest request) {
        log.warn("Erro de negócio tratado: status={} codigo={}", ex.getStatus().value(), ex.getCodigo());
        return ResponseEntity.status(ex.getStatus())
                .header(HttpHeaders.RETRY_AFTER, Long.toString(ex.segundos()))
                .body(corpo(ex, request, null));
    }

    private static ApiError corpo(ApiException ex, HttpServletRequest request,
                                  List<ApiError.FieldError> problemas) {
        return new ApiError(Instant.now(), ex.getStatus().value(), ex.getStatus().name(), ex.getMessage(), ex.getCodigo(),
                request.getRequestURI(), MDC.get(RequestIdFilter.MDC_KEY), problemas);
    }
}
