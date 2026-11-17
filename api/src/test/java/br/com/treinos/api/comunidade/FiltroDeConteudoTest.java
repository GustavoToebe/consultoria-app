package br.com.treinos.api.comunidade;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FiltroDeConteudoTest {

    @Test
    void bloqueiaIgnorandoAcentoECaixa() {
        assertThat(FiltroDeConteudo.bloqueia("Que BUCETA")).isTrue();
        assertThat(FiltroDeConteudo.bloqueia("bucéta")).isTrue();
        assertThat(FiltroDeConteudo.bloqueia("PORNÔ")).isTrue();
        assertThat(FiltroDeConteudo.bloqueia("fez uma OrGiA")).isTrue();
    }

    @Test
    void bloqueiaComPontuacaoColadaEntreEmojisEEmQualquerLugar() {
        assertThat(FiltroDeConteudo.bloqueia("buceta!")).isTrue();
        assertThat(FiltroDeConteudo.bloqueia("(punheta)")).isTrue();
        assertThat(FiltroDeConteudo.bloqueia("treino,xoxota,hoje")).isTrue();
        assertThat(FiltroDeConteudo.bloqueia("😀buceta😀")).isTrue();
        assertThat(FiltroDeConteudo.bloqueia("bom dia\nnudes\ncomo vai")).isTrue();
        assertThat(FiltroDeConteudo.bloqueia("ok_boquete_ok")).isTrue();
        assertThat(FiltroDeConteudo.bloqueia("  siririca")).isTrue();
    }

    @Test
    void bloqueiaTrocandoLetrasPorFormasEquivalentesOuCaracteresInvisiveis() {
        assertThat(FiltroDeConteudo.bloqueia("bu​ceta")).isTrue();
        assertThat(FiltroDeConteudo.bloqueia("ｂｕｃｅｔａ")).isTrue();
    }

    @Test
    void naoBloqueiaAnatomiaNemTreino() {
        assertThat(FiltroDeConteudo.bloqueia("Treino de peito e tríceps, depois coxa e glúteo")).isFalse();
        assertThat(FiltroDeConteudo.bloqueia("Bunda, seio, pau, pênis, vagina e abdômen são partes do corpo")).isFalse();
        assertThat(FiltroDeConteudo.bloqueia("Fiz agachamento, stiff e rosca direta. Rola um treino amanhã?")).isFalse();
        assertThat(FiltroDeConteudo.bloqueia("Fiz sexo, porra, transar e gostosa")).isFalse();
    }

    @Test
    void naoBloqueiaPalavraDaListaDentroDeOutraPalavra() {
        assertThat(FiltroDeConteudo.bloqueia("Viagem para a Georgia")).isFalse();
        assertThat(FiltroDeConteudo.bloqueia("bucetaria")).isFalse();
        assertThat(FiltroDeConteudo.bloqueia("antibuceta")).isFalse();
        assertThat(FiltroDeConteudo.bloqueia("nudesmaior")).isFalse();
        assertThat(FiltroDeConteudo.bloqueia("buceta123")).isFalse();
    }

    @Test
    void textoNuloOuVazioNaoBloqueia() {
        assertThat(FiltroDeConteudo.bloqueia(null)).isFalse();
        assertThat(FiltroDeConteudo.bloqueia("")).isFalse();
        assertThat(FiltroDeConteudo.bloqueia("   ")).isFalse();
    }

    @Test
    void aRecusaNuncaRepeteOTextoNemATermo() {
        assertThat(FiltroDeConteudo.MENSAGEM).isEqualTo("Sua publicação tem uma palavra não permitida.");
        assertThat(FiltroDeConteudo.ERRO.field()).isEqualTo("texto");
        assertThat(FiltroDeConteudo.ERRO.message()).isEqualTo(FiltroDeConteudo.MENSAGEM);
    }
}
