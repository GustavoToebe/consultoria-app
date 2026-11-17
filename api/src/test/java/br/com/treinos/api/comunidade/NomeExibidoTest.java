package br.com.treinos.api.comunidade;

import br.com.treinos.api.alunos.VotanteDaComunidade;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static br.com.treinos.api.comunidade.ExibicaoDoNome.APELIDO;
import static br.com.treinos.api.comunidade.ExibicaoDoNome.NOME;
import static br.com.treinos.api.comunidade.ExibicaoDoNome.NOME_COMPLETO;
import static br.com.treinos.api.comunidade.ExibicaoDoNome.NOME_E_APELIDO;
import static org.assertj.core.api.Assertions.assertThat;

/** O nome que outro aluno vê: regra pura, sem banco. Só nomes fictícios. */
class NomeExibidoTest {

    @Test
    void nuloValeNomeEQuatroOpcoes() {
        assertThat(NomeExibido.paraColegas(null, "Ana Souzalima", "Aninha")).isEqualTo("Ana");
        assertThat(NomeExibido.paraColegas(NOME, "Ana Souzalima", "Aninha")).isEqualTo("Ana");
        assertThat(NomeExibido.paraColegas(NOME_COMPLETO, "Ana Souzalima", "Aninha")).isEqualTo("Ana Souzalima");
        assertThat(NomeExibido.paraColegas(APELIDO, "Ana Souzalima", "Aninha")).isEqualTo("Aninha");
        assertThat(NomeExibido.paraColegas(NOME_E_APELIDO, "Ana Souzalima", "Aninha")).isEqualTo("Ana (Aninha)");
    }

    @Test
    void semApelidoApelidoENomeEApelidoCaemNoPrimeiroNome() {
        assertThat(NomeExibido.paraColegas(APELIDO, "Ana Souzalima", null)).isEqualTo("Ana");
        assertThat(NomeExibido.paraColegas(NOME_E_APELIDO, "Ana Souzalima", null)).isEqualTo("Ana");
        assertThat(NomeExibido.paraColegas(APELIDO, "Ana Souzalima", "  ")).isEqualTo("Ana");
        assertThat(NomeExibido.paraColegas(NOME_COMPLETO, "Ana Souzalima", null)).isEqualTo("Ana Souzalima");
    }

    @Test
    void espacosCaixaUmNomeSoEAcento() {
        assertThat(NomeExibido.paraColegas(NOME, "  Maria   da Silva  ", null)).isEqualTo("Maria");
        assertThat(NomeExibido.paraColegas(NOME_COMPLETO, "  Maria   da Silva  ", null)).isEqualTo("Maria da Silva");
        assertThat(NomeExibido.paraColegas(NOME, "JOÃO PEDRO LIMA", null)).isEqualTo("JOÃO");
        assertThat(NomeExibido.paraColegas(NOME, "Zélia", null)).isEqualTo("Zélia");
        assertThat(NomeExibido.paraColegas(NOME_E_APELIDO, "Zélia", "Zezé")).isEqualTo("Zélia (Zezé)");
        assertThat(NomeExibido.paraColegas(NOME, "Álvaro\tNunes", null)).isEqualTo("Álvaro");
    }

    @Test
    void espacoEspecialNoInicioNuncaDeixaOPrimeiroNomeVazio() {
        // NBSP, espaço estreito e separadores Unicode viram espaço comum ANTES do strip.
        assertThat(NomeExibido.paraColegas(NOME, " Ana Souzalima", null)).isEqualTo("Ana");
        assertThat(NomeExibido.paraColegas(NOME_E_APELIDO, " Ana Souzalima", "Aninha")).isEqualTo("Ana (Aninha)");
        assertThat(NomeExibido.paraColegas(NOME_COMPLETO, "   Ana  Souzalima ", null)).isEqualTo("Ana Souzalima");
        assertThat(NomeExibido.paraColegas(NOME, "　Ana Souzalima", null)).isEqualTo("Ana");
        // Sem nada utilizável: "Membro", nunca "" nem " (Aninha)".
        assertThat(NomeExibido.paraColegas(NOME, "  ", null)).isEqualTo("Membro");
        assertThat(NomeExibido.paraColegas(NOME_E_APELIDO, " ", "Aninha")).isEqualTo("Membro");
    }

    /** Documenta o limite: o servidor não adivinha ordem de nome nem trata caractere invisível que não é espaço. */
    @Test
    void limiteDoPrimeiroNomeSemHeuristicaDeNome() {
        // U+200B (espaço de largura zero) não é separador de palavra: "Ana<ZWSP>Souzalima" é uma palavra só.
        assertThat(NomeExibido.paraColegas(NOME, "Ana​Souzalima", null)).isEqualTo("Ana​Souzalima");
        // "SOBRENOME, NOME" cadastrado assim: a primeira palavra é o sobrenome (com a vírgula).
        assertThat(NomeExibido.paraColegas(NOME, "SOUZALIMA, ANA", null)).isEqualTo("SOUZALIMA,");
    }

    @Test
    void nomeVazioOuNuloNuncaVazaNada() {
        assertThat(NomeExibido.paraColegas(NOME_COMPLETO, null, "Aninha")).isEqualTo("Membro");
        assertThat(NomeExibido.paraColegas(APELIDO, "   ", null)).isEqualTo("Membro");
    }

    @Test
    void equipeVeNomeGravadoEApelidoSoDeAlunoAtivo() {
        VotanteDaComunidade ativo = aluno(true, null, "Aninha", NOME);
        assertThat(NomeExibido.doAluno(false, ativo, "Ana Souzalima")).isEqualTo(new NomeExibido.Nome("Ana Souzalima", "Aninha"));
        VotanteDaComunidade inativo = aluno(false, null, "Aninha", NOME);
        assertThat(NomeExibido.doAluno(false, inativo, "Ana Souzalima")).isEqualTo(new NomeExibido.Nome("Ana Souzalima", null));
    }

    @Test
    void alunoVeNomeMontadoEApelidoSempreNulo() {
        assertThat(NomeExibido.doAluno(true, aluno(true, null, "Aninha", NOME_E_APELIDO), "Ana Souzalima"))
                .isEqualTo(new NomeExibido.Nome("Ana (Aninha)", null));
        assertThat(NomeExibido.doAluno(true, aluno(true, null, "Aninha", null), "Ana Souzalima"))
                .isEqualTo(new NomeExibido.Nome("Ana", null));
        assertThat(NomeExibido.doAluno(true, aluno(true, null, null, NOME_COMPLETO), "Ana Souzalima"))
                .isEqualTo(new NomeExibido.Nome("Ana Souzalima", null));
        // Inativo perde o apelido: APELIDO cai no primeiro nome.
        assertThat(NomeExibido.doAluno(true, aluno(false, null, "Aninha", APELIDO), "Ana Souzalima"))
                .isEqualTo(new NomeExibido.Nome("Ana", null));
    }

    @Test
    void anonimizadoMostraSoOTextoJaAnonimizado() {
        VotanteDaComunidade anonimizado = new VotanteDaComunidade(UUID.randomUUID(), UUID.randomUUID(), "Aluno anonimizado", null, false,
                Instant.now(), null, null, null);
        assertThat(NomeExibido.doAluno(true, anonimizado, "Aluno anonimizado")).isEqualTo(new NomeExibido.Nome("Aluno anonimizado", null));
    }

    private static VotanteDaComunidade aluno(boolean ativo, Instant anonimizadoEm, String apelido, ExibicaoDoNome exibicao) {
        return new VotanteDaComunidade(UUID.randomUUID(), UUID.randomUUID(), "Ana Souzalima", apelido, ativo, anonimizadoEm, null, null,
                exibicao);
    }
}
