package br.com.treinos.api.dieta;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;

/**
 * Conteúdo do plano de dieta, no formato dos PDFs do Saraiva. Os valores de cada item são calculados no
 * app ao editar e gravados aqui; a versão publicada guarda os números e não recalcula. {@code suplementacao} é campo
 * livre do treinador: o sistema só guarda e mostra (sem validar, sugerir nem calcular nada).
 *
 * <p>{@code ergogenicos} (medicação e ergogênicos do aluno) é dado sensível: só sai do servidor para quem tem
 * {@code ERGOGENICO_LER} (e para o próprio aluno), só muda com {@code ERGOGENICO_ALTERAR} e nunca vai para modelo
 * ({@link #semErgogenicos()}). Dose, horário e prescrição são texto que o treinador escreve; nada é sugerido nem calculado.
 *
 * <p>{@code aguaLitros} é a água por dia que o treinador escreveu (pedido do Saraiva em 17/10, para o aluno ver no início).
 * Só se mostra: o sistema não calcula, não sugere meta e não registra consumo. Nulo = não aparece.
 *
 * <p>{@code Item.fatorCorrecao}/{@code Item.fatorCoccao} são os fatores do alimento da biblioteca, copiados pelo servidor
 * ao publicar ({@code PlanoDietaService.paraPublicar}) para a versão imutável levar o que o app do aluno precisa para a
 * lista de compras, inclusive sem internet. O que o cliente manda nesses campos não vale: a publicação regrava os dois.
 * {@code Item.grupo} (grupo do alimento, que agrupa a lista de compras) segue a mesma regra: copiado do alimento atual
 * na publicação, nulo no item manual.
 */
public record ConteudoDieta(
        @Size(max = 200) String objetivo,
        @Size(max = 10) String dataInicio,
        @Size(max = 120) String profissional,
        @NotNull @Size(max = 12) List<@Valid @NotNull Refeicao> refeicoes,
        @Size(max = 30) List<@Valid @NotNull Orientacao> orientacoes,
        @Size(max = 8000) String observacoes,
        @Size(max = 40) List<@Valid @NotNull Suplemento> suplementacao,
        @Size(max = 40) List<@Valid @NotNull Ergogenico> ergogenicos,
        @DecimalMin("0") @DecimalMax("100") BigDecimal aguaLitros) {

    /** Sem a água por dia. */
    public ConteudoDieta(String objetivo, String dataInicio, String profissional, List<Refeicao> refeicoes,
                         List<Orientacao> orientacoes, String observacoes, List<Suplemento> suplementacao,
                         List<Ergogenico> ergogenicos) {
        this(objetivo, dataInicio, profissional, refeicoes, orientacoes, observacoes, suplementacao, ergogenicos, null);
    }

    /** Sem a lista de medicação e ergogênicos nem a água (a maior parte dos usos). */
    public ConteudoDieta(String objetivo, String dataInicio, String profissional, List<Refeicao> refeicoes,
                         List<Orientacao> orientacoes, String observacoes, List<Suplemento> suplementacao) {
        this(objetivo, dataInicio, profissional, refeicoes, orientacoes, observacoes, suplementacao, null, null);
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
            Boolean manual,
            BigDecimal fatorCorrecao,
            BigDecimal fatorCoccao,
            @Size(max = 60) String grupo) {

        /** Sem os dados da biblioteca (rascunho, modelo, seed e testes: só a publicação os preenche). */
        public Item(UUID uid, UUID alimentoId, String nome, BigDecimal quantidade, String unidade, BigDecimal kcal,
                    BigDecimal proteina, BigDecimal carboidrato, BigDecimal gordura, Boolean manual) {
            this(uid, alimentoId, nome, quantidade, unidade, kcal, proteina, carboidrato, gordura, manual, null, null,
                    null);
        }

        /** Cópia com os fatores e o grupo trocados (a publicação põe os do alimento atual; nulos sem alimento). */
        public Item comDadosDaBiblioteca(BigDecimal correcao, BigDecimal coccao, String grupoDoAlimento) {
            return new Item(uid, alimentoId, nome, quantidade, unidade, kcal, proteina, carboidrato, gordura, manual,
                    correcao, coccao, grupoDoAlimento);
        }
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
                lista, aguaLitros);
    }

    public List<Refeicao> refeicoesOuVazio() {
        return refeicoes == null ? List.of() : refeicoes;
    }

    public List<Suplemento> suplementacaoOuVazio() {
        return suplementacao == null ? List.of() : suplementacao;
    }

    /** Cópia com cada item trocado por {@code troca} (mesmos uids e o resto igual). */
    public ConteudoDieta comItens(UnaryOperator<Item> troca) {
        List<Refeicao> novas = refeicoes == null ? null : refeicoes.stream().map(r -> new Refeicao(r.uid(), r.nome(),
                r.horario(), r.observacao(), r.opcoes() == null ? null : r.opcoes().stream().map(o -> new Opcao(
                        o.uid(), o.rotulo(), o.itens() == null ? null : o.itens().stream().map(troca).toList()))
                        .toList())).toList();
        return new ConteudoDieta(objetivo, dataInicio, profissional, novas, orientacoes, observacoes, suplementacao,
                ergogenicos, aguaLitros);
    }

    /** Cópia com uids novos (receita, cópia ou replicação). */
    public ConteudoDieta comUidsNovos() {
        Supplier<UUID> novo = UUID::randomUUID;
        List<Refeicao> novas = refeicoesOuVazio().stream().map(r -> new Refeicao(novo.get(), r.nome(), r.horario(),
                r.observacao(), r.opcoesOuVazio().stream().map(o -> new Opcao(novo.get(), o.rotulo(),
                        o.itensOuVazio().stream().map(i -> new Item(novo.get(), i.alimentoId(), i.nome(),
                                i.quantidade(), i.unidade(), i.kcal(), i.proteina(), i.carboidrato(), i.gordura(),
                                i.manual(), i.fatorCorrecao(), i.fatorCoccao(), i.grupo())).toList())).toList()))
                .toList();
        List<Suplemento> suplementos = suplementacaoOuVazio().stream().map(s -> new Suplemento(novo.get(), s.nome(),
                s.dose(), s.horario(), s.observacao(), s.link())).toList();
        List<Ergogenico> medicacao = ergogenicos == null ? null : ergogenicos.stream().map(e -> new Ergogenico(novo.get(),
                e.nome(), e.principioAtivo(), e.concentracao(), e.dose(), e.horario(), e.observacao(),
                e.prescricao())).toList();
        return new ConteudoDieta(objetivo, dataInicio, profissional, novas, orientacoes, observacoes, suplementos,
                medicacao, aguaLitros);
    }
}
