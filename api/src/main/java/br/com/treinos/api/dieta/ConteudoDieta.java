package br.com.treinos.api.dieta;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Conteúdo do plano de dieta (seção 7.2), no formato dos PDFs do Saraiva. Os valores de cada item são calculados no
 * app ao editar e gravados aqui; a versão publicada guarda os números e não recalcula. {@code suplementacao} é campo
 * livre do treinador: o sistema só guarda e mostra (sem validar, sugerir nem calcular nada).
 *
 * <p>{@code ergogenicos} (medicação e ergogênicos do aluno) é dado sensível: só sai do servidor para quem tem
 * {@code ERGOGENICO_LER} (e para o próprio aluno), só muda com {@code ERGOGENICO_ALTERAR} e nunca vai para modelo
 * ({@link #semErgogenicos()}). Dose, horário e prescrição são texto que o treinador escreve; nada é sugerido nem calculado.
 */
public record ConteudoDieta(
        @Size(max = 200) String objetivo,
        @Size(max = 10) String dataInicio,
        @Size(max = 120) String profissional,
        @NotNull @Size(max = 12) List<@Valid @NotNull Refeicao> refeicoes,
        @Size(max = 30) List<@Valid @NotNull Orientacao> orientacoes,
        @Size(max = 8000) String observacoes,
        @Size(max = 40) List<@Valid @NotNull Suplemento> suplementacao,
        @Size(max = 40) List<@Valid @NotNull Ergogenico> ergogenicos) {

    /** Sem a lista de medicação e ergogênicos (a maior parte dos usos). */
    public ConteudoDieta(String objetivo, String dataInicio, String profissional, List<Refeicao> refeicoes,
                         List<Orientacao> orientacoes, String observacoes, List<Suplemento> suplementacao) {
        this(objetivo, dataInicio, profissional, refeicoes, orientacoes, observacoes, suplementacao, null);
    }

    public record Refeicao(
            UUID uid,
            @Size(max = 80) String nome,
            @Size(max = 5) String horario,
            @Size(max = 1000) String observacao,
            @Size(max = 6) List<@Valid @NotNull Opcao> opcoes) {

        public List<Opcao> opcoesOuVazio() {
            return opcoes == null ? List.of() : opcoes;
        }
    }

    public record Opcao(
            UUID uid,
            @Size(max = 10) String rotulo,
            @Size(max = 40) List<@Valid @NotNull Item> itens) {

        public List<Item> itensOuVazio() {
            return itens == null ? List.of() : itens;
        }
    }

    public record Item(
            UUID uid,
            UUID alimentoId,
            @Size(max = 160) String nome,
            BigDecimal quantidade,
            @Size(max = 5) String unidade,
            BigDecimal kcal,
            BigDecimal proteina,
            BigDecimal carboidrato,
            BigDecimal gordura,
            Boolean manual) {
    }

    public record Orientacao(@Size(max = 80) String titulo, @Size(max = 2000) String texto) {
    }

    public record Suplemento(
            UUID uid,
            @Size(max = 120) String nome,
            @Size(max = 120) String dose,
            @Size(max = 120) String horario,
            @Size(max = 500) String observacao,
            @Size(max = 500) String link) {
    }

    /** Item copiado da biblioteca (nome, princípio ativo, concentração); o resto o treinador escreve. */
    public record Ergogenico(
            UUID uid,
            @Size(max = 120) String nome,
            @Size(max = 160) String principioAtivo,
            @Size(max = 40) String concentracao,
            @Size(max = 120) String dose,
            @Size(max = 120) String horario,
            @Size(max = 500) String observacao,
            @Size(max = 200) String prescricao) {
    }

    public static ConteudoDieta vazio() {
        return new ConteudoDieta(null, null, null, List.of(), List.of(), null, List.of());
    }

    /** Cópia sem a lista de medicação e ergogênicos (modelos nunca a levam). */
    public ConteudoDieta semErgogenicos() {
        return comErgogenicos(null);
    }

    public ConteudoDieta comErgogenicos(List<Ergogenico> lista) {
        return new ConteudoDieta(objetivo, dataInicio, profissional, refeicoes, orientacoes, observacoes, suplementacao,
                lista);
    }

    public List<Refeicao> refeicoesOuVazio() {
        return refeicoes == null ? List.of() : refeicoes;
    }

    public List<Suplemento> suplementacaoOuVazio() {
        return suplementacao == null ? List.of() : suplementacao;
    }

    /** Cópia com uids novos (receita, cópia ou replicação). */
    public ConteudoDieta comUidsNovos() {
        Supplier<UUID> novo = UUID::randomUUID;
        List<Refeicao> novas = refeicoesOuVazio().stream().map(r -> new Refeicao(novo.get(), r.nome(), r.horario(),
                r.observacao(), r.opcoesOuVazio().stream().map(o -> new Opcao(novo.get(), o.rotulo(),
                        o.itensOuVazio().stream().map(i -> new Item(novo.get(), i.alimentoId(), i.nome(),
                                i.quantidade(), i.unidade(), i.kcal(), i.proteina(), i.carboidrato(), i.gordura(),
                                i.manual())).toList())).toList())).toList();
        List<Suplemento> suplementos = suplementacaoOuVazio().stream().map(s -> new Suplemento(novo.get(), s.nome(),
                s.dose(), s.horario(), s.observacao(), s.link())).toList();
        List<Ergogenico> medicacao = ergogenicos == null ? null : ergogenicos.stream().map(e -> new Ergogenico(novo.get(),
                e.nome(), e.principioAtivo(), e.concentracao(), e.dose(), e.horario(), e.observacao(),
                e.prescricao())).toList();
        return new ConteudoDieta(objetivo, dataInicio, profissional, novas, orientacoes, observacoes, suplementos,
                medicacao);
    }
}
