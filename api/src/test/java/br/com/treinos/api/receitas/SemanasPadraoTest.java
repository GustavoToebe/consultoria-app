package br.com.treinos.api.receitas;

import br.com.treinos.api.mobilidade.ValidadorMobilidade;
import br.com.treinos.api.receitas.Receita.Tipo;
import br.com.treinos.api.receitas.SemanasPadrao.Modelo;
import br.com.treinos.api.treino.ConteudoTreino;
import br.com.treinos.api.treino.ValidadorTreino;
import br.com.treinos.api.web.VideoUrls;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** 32 Semanas, os Dias da Variação 1 e as 3 mobilidades novas. O conteúdo do Saraiva não entra. */
class SemanasPadraoTest {

    @Test
    void conjuntoSemOsPlanosDoSaraiva() {
        assertThat(SemanasPadrao.semanas()).hasSize(32);
        assertThat(SemanasPadrao.dias()).hasSize(37);
        assertThat(SemanasPadrao.mobilidades()).hasSize(3);
        assertThat(SemanasPadrao.semanas()).allSatisfy(m -> assertThat(m.tipo()).isEqualTo(Tipo.PLANO_TREINO));
        assertThat(SemanasPadrao.dias()).allSatisfy(m -> assertThat(m.tipo()).isEqualTo(Tipo.SESSAO_TREINO));
        assertThat(SemanasPadrao.mobilidades()).extracting(Modelo::nome).containsExactly(
                "Mobilidade de quadril e membros inferiores",
                "Mobilidade de ombro e coluna torácica",
                "Mobilidade geral do corpo todo (8 a 10 minutos)");
        assertThat(SemanasPadrao.todos()).extracting(Modelo::nome)
                .noneMatch(nome -> nome.startsWith("Plano ") || nome.startsWith("Wellness")
                        || nome.startsWith("Mobilidade e alongamentos"));
    }

    @Test
    void publicacaoDasSemanasDosDiasEDaMobilidade() {
        VideoUrls videos = new VideoUrls(List.of("youtube.com", "www.youtube.com", "youtu.be"));
        ValidadorTreino treino = new ValidadorTreino(videos);
        ValidadorMobilidade mobilidade = new ValidadorMobilidade(videos);
        for (Modelo modelo : SemanasPadrao.semanas()) {
            var resultado = treino.validar((ConteudoTreino) modelo.conteudo(), null, null);
            assertThat(resultado.erros()).as(modelo.nome()).isEmpty();
            assertThat(resultado.avisos()).as(modelo.nome()).isEmpty();
        }
        for (Modelo modelo : SemanasPadrao.dias()) {
            var resultado = treino.validar((ConteudoTreino) modelo.conteudo(), null, null);
            assertThat(resultado.erros()).as(modelo.nome()).isEmpty();
            assertThat(resultado.avisos()).as(modelo.nome())
                    .extracting(br.com.treinos.api.planos.ResultadoValidacao.Problema::mensagem)
                    .containsOnly("O plano não tem dia de descanso.");
        }
        for (Modelo modelo : SemanasPadrao.mobilidades()) {
            var resultado = mobilidade.validar((ConteudoMobilidade) modelo.conteudo(), null, null);
            assertThat(resultado.erros()).as(modelo.nome()).isEmpty();
            assertThat(resultado.avisos()).as(modelo.nome()).isEmpty();
        }
    }
}
