package br.com.treinos.api.inscricoes;

import br.com.treinos.api.questionarios.ConteudoQuestionario;
import br.com.treinos.api.questionarios.ConteudoQuestionario.Opcao;
import br.com.treinos.api.questionarios.ConteudoQuestionario.Pergunta;
import br.com.treinos.api.questionarios.ConteudoQuestionario.Secao;

import java.util.List;

/**
 * O que a página pública mostra das perguntas do treinador: só o necessário para responder. Saem o resumo do treinador
 * ({@code destaque}, {@code rotuloCurto}), a ajuda automática, a imagem e o destino no cadastro (a publicação de um
 * questionário de inscrição já recusa os três últimos; aqui é a segunda linha de defesa) e o {@code valorNoCadastro} das
 * opções. O nome e a descrição do questionário nunca entram (são de trabalho da equipe).
 */
final class PerguntasPublicas {

    private PerguntasPublicas() { }

    static ConteudoQuestionario de(ConteudoQuestionario c) {
        List<Secao> secoes = c.secoes() == null ? List.of() : c.secoes().stream()
                .map(s -> new Secao(s.uid(), s.titulo(), s.descricao(),
                        s.perguntas() == null ? List.of() : s.perguntas().stream().map(PerguntasPublicas::pergunta).toList(),
                        s.mostrarSe()))
                .toList();
        return new ConteudoQuestionario(c.formato(), c.instrucoes() == null ? List.of() : c.instrucoes(), secoes);
    }

    private static Pergunta pergunta(Pergunta p) {
        return new Pergunta(p.id(), p.tipo(), p.rotulo(), Boolean.TRUE.equals(p.obrigatoria()), p.ajuda(), null, null, null,
                p.dias(), opcoes(p.opcoes()), p.unidade(), p.min(), p.max(), p.casas(), null, p.somentePassado(),
                opcoes(p.linhas()), opcoes(p.colunas()), p.texto(), p.declaracao(), p.mostrarSe(), null, null, p.rotuloMin(),
                p.rotuloMax());
    }

    private static List<Opcao> opcoes(List<Opcao> opcoes) {
        return opcoes == null ? null : opcoes.stream().map(o -> new Opcao(o.id(), o.rotulo())).toList();
    }
}
