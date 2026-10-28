package br.com.treinos.api.biblioteca;

import br.com.treinos.api.dieta.ConteudoDieta;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Regras do grupo do alimento (texto livre, até 60) e a cópia dele no item da dieta, sem banco. */
class GrupoDoAlimentoTest {

    @Test
    void normalizaEspacosEControleEVazioViraNulo() {
        assertThat(GrupoDoAlimento.normalizar(null)).isNull();
        assertThat(GrupoDoAlimento.normalizar("   ")).isNull();
        assertThat(GrupoDoAlimento.normalizar("\t\n")).isNull();
        assertThat(GrupoDoAlimento.normalizar("  Carnes   e\tovos ")).isEqualTo("Carnes e ovos");
        assertThat(GrupoDoAlimento.normalizar("Leite\u0000e derivados")).isEqualTo("Leite e derivados");
    }

    @Test
    void limiteDeSessentaContaCaracteresDepoisDeNormalizar() {
        String sessenta = "a".repeat(60);
        assertThat(GrupoDoAlimento.longoDemais(sessenta)).isFalse();
        assertThat(GrupoDoAlimento.longoDemais(sessenta + "b")).isTrue();
        assertThat(GrupoDoAlimento.longoDemais(GrupoDoAlimento.normalizar("  " + sessenta + "   "))).isFalse();
        assertThat(GrupoDoAlimento.longoDemais("ç".repeat(60))).isFalse();
        assertThat(GrupoDoAlimento.longoDemais(null)).isFalse();
    }

    @Test
    void doCatalogoNormalizaECortaNoTamanhoDaColuna() {
        assertThat(GrupoDoAlimento.doCatalogo("Verduras, hortaliças e derivados")).isEqualTo("Verduras, hortaliças e derivados");
        assertThat(GrupoDoAlimento.doCatalogo(null)).isNull();
        assertThat(GrupoDoAlimento.doCatalogo(" ")).isNull();
        assertThat(GrupoDoAlimento.doCatalogo("x".repeat(80))).hasSize(60);
    }

    @Test
    void itemDaDietaLevaOGrupoNaCopiaENaTrocaDosDadosDaBiblioteca() {
        ConteudoDieta.Item item = new ConteudoDieta.Item(UUID.randomUUID(), UUID.randomUUID(), "Arroz fictício",
                new BigDecimal("100"), "g", BigDecimal.TEN, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ONE, false);
        assertThat(item.grupo()).isNull();
        ConteudoDieta.Item daBiblioteca = item.comDadosDaBiblioteca(new BigDecimal("1.10"), null, "Cereais e derivados");
        assertThat(daBiblioteca.grupo()).isEqualTo("Cereais e derivados");
        assertThat(daBiblioteca.fatorCorrecao()).isEqualByComparingTo("1.10");
        assertThat(daBiblioteca.uid()).isEqualTo(item.uid());

        ConteudoDieta conteudo = new ConteudoDieta(null, null, null, List.of(new ConteudoDieta.Refeicao(UUID.randomUUID(),
                "Almoço", "12:00", null, List.of(new ConteudoDieta.Opcao(UUID.randomUUID(), "A", List.of(daBiblioteca))))),
                List.of(), null, List.of());
        ConteudoDieta.Item copiado = conteudo.comUidsNovos().refeicoes().get(0).opcoes().get(0).itens().get(0);
        assertThat(copiado.uid()).isNotEqualTo(item.uid());
        assertThat(copiado.grupo()).isEqualTo("Cereais e derivados");
        ConteudoDieta.Item limpo = conteudo.comItens(i -> i.comDadosDaBiblioteca(null, null, null)).refeicoes().get(0)
                .opcoes().get(0).itens().get(0);
        assertThat(limpo.grupo()).isNull();
    }
}
