package br.com.treinos.api.planos;

import br.com.plataforma.comum.web.ApiError;

import java.util.ArrayList;
import java.util.List;

/**
 * Resultado do validador de um plano: erros bloqueiam a publicação; avisos pedem confirmação. {@code caminho} aponta
 * o item no conteúdo (ex.: {@code sessoes[0].exercicios[1].series[2].repsMax}) para o app destacar.
 */
public record ResultadoValidacao(List<Problema> erros, List<Problema> avisos) {

    public record Problema(String caminho, String mensagem) {
    }

    public boolean temErros() {
        return !erros.isEmpty();
    }

    public boolean temAvisos() {
        return !avisos.isEmpty();
    }

    public static List<ApiError.FieldError> comoCampos(List<Problema> problemas) {
        return problemas.stream().map(p -> new ApiError.FieldError(p.caminho(), p.mensagem())).toList();
    }

    /** Acumulador usado pelos validadores. */
    public static final class Coletor {
        private final List<Problema> erros = new ArrayList<>();
        private final List<Problema> avisos = new ArrayList<>();

        public void erro(String caminho, String mensagem) {
            erros.add(new Problema(caminho, mensagem));
        }

        public void aviso(String caminho, String mensagem) {
            avisos.add(new Problema(caminho, mensagem));
        }

        public ResultadoValidacao resultado() {
            return new ResultadoValidacao(List.copyOf(erros), List.copyOf(avisos));
        }
    }
}
