package br.com.treinos.api.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.ServletWebRequest;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

import java.time.Instant;
import java.util.List;

/**
 * Toda resposta de erro sai como {@link ApiError}, sem stack trace, SQL nem nome de classe. O log leva só status e
 * código: a mensagem pode citar dado do aluno e dado de saúde nunca vai para log (regra 4 do plano).
 */
@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ApiError> handleApiException(ApiException ex, HttpServletRequest request) {
        log.warn("Erro de negócio tratado: status={} codigo={}", ex.getStatus().value(), ex.getCodigo());
        ResponseEntity.BodyBuilder resposta = ResponseEntity.status(ex.getStatus());
        if (ex instanceof MuitasRequisicoesException limite) {
            resposta.header(HttpHeaders.RETRY_AFTER, Long.toString(limite.segundos()));
        }
        List<ApiError.FieldError> problemas = ex instanceof ValidacaoException v ? v.getProblemas() : null;
        return resposta.body(corpo(ex.getStatus(), ex.getMessage(), ex.getCodigo(), request, problemas));
    }

    /** Outra aba ou pessoa salvou antes: o app mostra "Recarregar" (seção 10.4 do plano). */
    @ExceptionHandler(ObjectOptimisticLockingFailureException.class)
    public ResponseEntity<ApiError> handleLockOtimista(ObjectOptimisticLockingFailureException ex,
                                                       HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(corpo(HttpStatus.CONFLICT,
                "Outra pessoa ou aba alterou este registro. Recarregue para ver a versão atual.", "CONFLITO_EDICAO",
                request, null));
    }

    /** Relança para o {@code ExceptionTranslationFilter}; sem isto o catch-all transformaria o 403 em 500. */
    @ExceptionHandler(AccessDeniedException.class)
    public void handleAccessDenied(AccessDeniedException ex) {
        throw ex;
    }

    @ExceptionHandler(AuthenticationException.class)
    public void handleAuthentication(AuthenticationException ex) {
        throw ex;
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiError> handleConstraintViolation(ConstraintViolationException ex,
                                                              HttpServletRequest request) {
        List<ApiError.FieldError> fieldErrors = ex.getConstraintViolations().stream()
                .map(v -> new ApiError.FieldError(v.getPropertyPath().toString(), v.getMessage()))
                .toList();
        return ResponseEntity.badRequest()
                .body(corpo(HttpStatus.BAD_REQUEST, "Requisição inválida.", "DADOS_INVALIDOS", request, fieldErrors));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleUnexpected(Exception ex, HttpServletRequest request) {
        log.error("Erro não tratado ao processar requisição", ex);
        return ResponseEntity.internalServerError().body(corpo(HttpStatus.INTERNAL_SERVER_ERROR,
                "Ocorreu um erro inesperado. Tente novamente ou informe o requestId ao suporte.", null, request, null));
    }

    @Override
    protected ResponseEntity<Object> handleMethodArgumentNotValid(
            MethodArgumentNotValidException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        List<ApiError.FieldError> fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> new ApiError.FieldError(fe.getField(), fe.getDefaultMessage()))
                .toList();
        return ResponseEntity.badRequest().body(corpo(HttpStatus.BAD_REQUEST, "Um ou mais campos são inválidos.",
                "DADOS_INVALIDOS", http(request), fieldErrors));
    }

    @Override
    protected ResponseEntity<Object> handleHttpMessageNotReadable(
            HttpMessageNotReadableException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        if (causadoPorCorpoExcedido(ex)) {
            CorpoExcedidoException erro = new CorpoExcedidoException();
            return ResponseEntity.status(erro.getStatus())
                    .body(corpo(erro.getStatus(), erro.getMessage(), erro.getCodigo(), http(request), null));
        }
        return ResponseEntity.badRequest().body(corpo(HttpStatus.BAD_REQUEST,
                "Corpo da requisição malformado ou ilegível.", "DADOS_INVALIDOS", http(request), null));
    }

    /** Upload acima de {@code spring.servlet.multipart} (logo até 512 KiB). */
    @Override
    protected ResponseEntity<Object> handleMaxUploadSizeExceededException(
            MaxUploadSizeExceededException ex, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
        CorpoExcedidoException erro = new CorpoExcedidoException();
        return ResponseEntity.status(erro.getStatus())
                .body(corpo(erro.getStatus(), erro.getMessage(), erro.getCodigo(), http(request), null));
    }

    /** Demais erros do Spring MVC (rota inexistente, 405, 415...) também saem como {@link ApiError}. */
    @Override
    protected ResponseEntity<Object> handleExceptionInternal(
            Exception ex, Object body, HttpHeaders headers, HttpStatusCode statusCode, WebRequest request) {
        HttpStatus status = HttpStatus.resolve(statusCode.value());
        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }
        String codigo = status == HttpStatus.NOT_FOUND ? "NAO_ENCONTRADO" : null;
        return ResponseEntity.status(status).headers(headers)
                .body(corpo(status, status.getReasonPhrase(), codigo, http(request), null));
    }

    private static boolean causadoPorCorpoExcedido(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause()) {
            if (t instanceof LimiteCorpoFilter.CorpoExcedidoIOException) {
                return true;
            }
        }
        return false;
    }

    private static HttpServletRequest http(WebRequest request) {
        return request instanceof ServletWebRequest servlet ? servlet.getRequest() : null;
    }

    private static ApiError corpo(HttpStatus status, String message, String codigo, HttpServletRequest request,
                                  List<ApiError.FieldError> fieldErrors) {
        return new ApiError(Instant.now(), status.value(), status.name(), message, codigo,
                request != null ? request.getRequestURI() : null, MDC.get(RequestIdFilter.MDC_KEY), fieldErrors);
    }
}
