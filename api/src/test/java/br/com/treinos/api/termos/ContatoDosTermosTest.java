package br.com.treinos.api.termos;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ContatoDosTermosTest {

    @Test
    void comTudoPreenchidoListaNomeWhatsAppEEmail() {
        assertThat(ContatoDosTermos.montar("Equipe Fictícia", "(45) 99999-8888", "contato@exemplo.test")).isEqualTo(
                "- **Consultoria:** Equipe Fictícia\n- **WhatsApp:** (45) 99999-8888\n- **E-mail:** contato@exemplo.test");
    }

    @Test
    void comUmCanalSoMostraOQueExiste() {
        assertThat(ContatoDosTermos.montar("Equipe Fictícia", " ", "contato@exemplo.test"))
                .isEqualTo("- **Consultoria:** Equipe Fictícia\n- **E-mail:** contato@exemplo.test");
        assertThat(ContatoDosTermos.montar("Equipe Fictícia", "(45) 99999-8888", null))
                .isEqualTo("- **Consultoria:** Equipe Fictícia\n- **WhatsApp:** (45) 99999-8888");
    }

    @Test
    void semCanalMostraONomeEFalarPeloApp() {
        assertThat(ContatoDosTermos.montar("Equipe Fictícia", null, ""))
                .isEqualTo("- **Consultoria:** Equipe Fictícia\n\nFale com o seu treinador pelo app.");
    }

    @Test
    void semConsultoriaSoAFraseENuncaOColchete() {
        String contato = ContatoDosTermos.montar(null, null, null);
        assertThat(contato).isEqualTo("Fale com o seu treinador pelo app.").doesNotContain("[", "{{");
    }

    @Test
    void nomeComAsteriscoOuQuebraNaoLigaONegritoNemQuebraOItem() {
        assertThat(ContatoDosTermos.montar("**Equipe**\nFictícia", "(45) 99999-8888", null))
                .isEqualTo("- **Consultoria:** Equipe Fictícia\n- **WhatsApp:** (45) 99999-8888");
    }

    @Test
    void oMarcadorEstaNoTermoDeUsoESaiAoMontar() {
        Termos.Documento termo = Termos.documentos("X").getFirst();
        assertThat(termo.id()).isEqualTo("TERMO_USO");
        assertThat(termo.texto()).contains("## 8. Contato\nX").doesNotContain(ContatoDosTermos.MARCADOR, "PREENCHER]");
        assertThat(Termos.documentos("X")).allSatisfy(d -> assertThat(d.texto()).doesNotContain("RASCUNHO", "{{"));
        // O contato de privacidade do aviso usa o mesmo marcador (decisão de 28/11, a confirmar com o advogado do cliente).
        assertThat(Termos.documentos("X").get(1).texto()).contains("**Contato para assuntos de privacidade:**\nX");
    }

    /** Colchete de modelo (`[CONTATO … PREENCHER]`, `[REVISAR …]`) ou marcador `{{…}}` não resolvido: nunca no texto servido. */
    static final java.util.regex.Pattern COLCHETE_DE_MODELO =
            java.util.regex.Pattern.compile("\\[[A-ZÀ-Ú][^\\]]*(PREENCHER|REVISAR|CONTATO)[^\\]]*\\]|\\{\\{");

    @Test
    void nenhumColcheteDeModeloNemMarcadorSobraNoTextoServido() {
        for (String contato : new String[] {ContatoDosTermos.montar(null, null, null), ContatoDosTermos.montar("Equipe", "(45) 99999-8888", "a@b.test")}) {
            assertThat(Termos.documentos(contato)).allSatisfy(d -> assertThat(COLCHETE_DE_MODELO.matcher(d.texto()).find())
                    .as("colchete de modelo em %s", d.id()).isFalse());
        }
    }

    @Test
    void notaInternaSaiDoTextoEFicaSoNaListaDaEquipeSemMexerNoTextoEmVolta() {
        String aviso = Termos.documentos("X").get(1).texto();
        assertThat(aviso).doesNotContain("REVISAR COM ADVOGADO", "base legal da transferência")
                .contains("feita com as\nmedidas de segurança descritas abaixo.\n\n## 7.");
        assertThat(Termos.notasInternas()).containsExactly(new Termos.NotaInterna("AVISO_PRIVACIDADE", "Aviso de privacidade",
                "base legal da transferência internacional"));
    }
}
