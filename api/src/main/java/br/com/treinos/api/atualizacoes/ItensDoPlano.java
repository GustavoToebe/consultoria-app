package br.com.treinos.api.atualizacoes;

import java.util.List;

/**
 * Lista que o servidor aceita numa pergunta {@code ITENS_DO_PLANO}, por fonte ({@code ALIMENTOS_DA_DIETA},
 * {@code EXERCICIOS_DO_TREINO}, {@code DIAS_TREINADOS}). O nome de cada item vem sempre daqui (da versão liberada da pasta (a que o aluno vê)
 * ou dos registros do aluno), nunca do cliente, para a resposta continuar legível depois que o plano mudar.
 *
 * <p>Regras de id (o app monta a mesma lista pelo pacote salvo no aparelho e pelos registros locais):
 * <ul>
 *   <li>alimentos: o {@code uid} de cada item das refeições da versão liberada (raiz e variações, todas as opções);
 *       o app mostra um item por nome (o primeiro na ordem da versão); o servidor aceita o uid de qualquer item da versão
 *       e recusa dois itens com o mesmo nome na mesma resposta;</li>
 *   <li>exercícios: o {@code uid} de cada exercício principal do treino publicado (alternativas não entram: não têm
 *       uid); mesma regra de nome;</li>
 *   <li>dias treinados: a data ISO ({@code 2026-11-17}) de cada dia com série concluída do aluno entre o início da
 *       pasta e a data da atualização (a mesma conta do "N treinos" do resumo do período); sem nenhum registro no
 *       período (o check-in offline pode chegar antes das séries), vale o dia da semana ({@code "1"} segunda a {@code "7"}
 *       domingo, como {@code ConteudoDieta.dias}) OU qualquer data ISO entre o início da pasta e a data da atualização;</li>
 * </ul>
 */
@FunctionalInterface
public interface ItensDoPlano {

    /** Item aceito: {@code id} é o que o cliente envia; {@code nome} é o texto legível que o servidor grava. */
    record Item(String id, String nome) {
    }

    /** Itens da fonte (vazio quando a versão não tem nenhum). Fonte desconhecida: vazio. */
    List<Item> da(String fonte);

    /** Sem contexto de plano (anamnese, inscrição, seeds): toda resposta de ITENS_DO_PLANO é recusada. */
    ItensDoPlano NENHUM = fonte -> List.of();
}
