package br.com.treinos.api.web;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ApiException;
import org.springframework.http.HttpStatus;

import java.util.List;
import java.util.UUID;

/**
 * 409 que aponta o recurso que já existe, para o app oferecer "Abrir" (ex.: {@code ALUNO_JA_EXISTE} no aceite da
 * inscrição). O corpo de erro da biblioteca não tem campo extra: o id vai em {@code fieldErrors[0]} ({@code field} =
 * nome do id, {@code message} = o UUID); com uma lista de valores (datas em conflito de uma série), um item de
 * {@code fieldErrors} por valor. A mensagem nunca leva nome nem contato de pessoa.
 */
public class ConflitoComRecursoException extends ApiException {

    private static final long serialVersionUID = 1L;

    private final transient List<ApiError.FieldError> problemas;

    public ConflitoComRecursoException(String mensagem, String codigo, String campo, UUID id) {
        super(HttpStatus.CONFLICT, mensagem, codigo);
        this.problemas = List.of(new ApiError.FieldError(campo, id.toString()));
    }

    /**
     * 409 com uma lista de valores no mesmo campo, um item de {@code fieldErrors} por valor (ex.: {@code HORARIO_OCUPADO}
     * de uma série, com {@code datasEmConflito} e uma data ISO em cada {@code message}). Só valores sem dado pessoal.
     */
    public ConflitoComRecursoException(String mensagem, String codigo, String campo, List<String> valores) {
        super(HttpStatus.CONFLICT, mensagem, codigo);
        this.problemas = valores.stream().map(v -> new ApiError.FieldError(campo, v)).toList();
    }

    public List<ApiError.FieldError> getProblemas() {
        return problemas;
    }
}
