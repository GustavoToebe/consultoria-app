package br.com.treinos.api.receitas;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;
import java.util.function.UnaryOperator;

/**
 * Mobilidade e alongamento: seções (ex.: "Alongamentos", "Mobilidade") com itens que trazem o nome, a prescrição em
 * texto ("2 x 20s cada lado") e o link do vídeo. É o conteúdo do modelo (receita {@code MOBILIDADE}) e do plano de
 * mobilidade da pasta. Como no restante dos planos, o rascunho aceita conteúdo incompleto: as regras de publicação
 * (seção, nome, uid, vídeo) ficam no {@code ValidadorMobilidade}; o modelo as confere ao gravar, em
 * {@code ReceitaService}. Os {@code uid} são opcionais no JSON (modelos importados não têm) e obrigatórios na
 * publicação.
 */
public record ConteudoMobilidade(
        @Size(max = 2000) String orientacoes,
        @NotNull @Size(max = 10) List<@NotNull @Valid Secao> secoes) {

    public record Secao(UUID uid, @Size(max = 80) String titulo,
                        @NotNull @Size(max = 40) List<@NotNull @Valid Item> itens) { }

    public record Item(UUID uid, @Size(max = 120) String nome, @Size(max = 120) String prescricao,
                       @Size(max = 500) String videoUrl) { }

    public static ConteudoMobilidade vazio() {
        return new ConteudoMobilidade(null, List.of());
    }

    /** Todo uid sorteado de novo: replicar e criar de um modelo nunca reaproveitam identificador. */
    public ConteudoMobilidade comUidsNovos() {
        return new ConteudoMobilidade(orientacoes, secoes.stream().map(s -> new Secao(UUID.randomUUID(), s.titulo(),
                s.itens().stream().map(i -> new Item(UUID.randomUUID(), i.nome(), i.prescricao(), i.videoUrl()))
                        .toList())).toList());
    }

    /** Aplica {@code normalizar} ao vídeo de cada item e devolve o conteúdo com o que ela retornou. */
    public ConteudoMobilidade comVideos(UnaryOperator<String> normalizar) {
        return new ConteudoMobilidade(orientacoes, secoes.stream().map(s -> new Secao(s.uid(), s.titulo(),
                s.itens().stream().map(i -> new Item(i.uid(), i.nome(), i.prescricao(), normalizar.apply(i.videoUrl())))
                        .toList())).toList());
    }
}
