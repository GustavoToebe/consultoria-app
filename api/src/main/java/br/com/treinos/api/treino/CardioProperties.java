package br.com.treinos.api.treino;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Cardio intervalado novo ({@code TREINOS_CARDIO_INTERVALADO_HABILITADO}; docs/planos/cardio-e-hiit.md, D16). Desligado por
 * padrão: o app do aluno das lojas recusa o pacote offline com as chaves novas do cardio ({@code modo} em diante), então
 * salvar o rascunho ou publicar um treino com elas dá 422 e o app só oferece o contínuo ({@code cardioIntervaladoHabilitado}
 * no {@code GET /eu}). A leitura do que já está gravado não muda.
 */
@ConfigurationProperties("treinos.cardio")
public record CardioProperties(boolean intervaladoHabilitado) {
}
