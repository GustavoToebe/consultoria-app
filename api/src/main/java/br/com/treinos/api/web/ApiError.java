package br.com.treinos.api.web;

import java.time.Instant;
import java.util.List;

/** Mesmo corpo de erro da Central e do Servirea, com {@code codigo} estável para o app tratar (seção 9.5 do plano). */
public record ApiError(
        Instant timestamp,
        int status,
        String error,
        String message,
        String codigo,
        String path,
        String requestId,
        List<FieldError> fieldErrors
) {
    public record FieldError(String field, String message) {
    }
}
