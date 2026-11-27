package br.com.treinos.api.inscricoes;

import br.com.plataforma.comum.web.ApiError.FieldError;
import br.com.treinos.api.inscricoes.Crm.Periodicidade;
import br.com.treinos.api.inscricoes.InscricaoDtos.PlanoDaPagina;
import br.com.treinos.api.pagamentos.PagamentosProperties;
import br.com.treinos.api.pagamentos.PeriodoDoPlano;
import br.com.treinos.api.pagamentos.PlanoComercial;
import br.com.treinos.api.pagamentos.PlanoComercialRepository;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Planos comerciais na inscrição pública (sugestão do plano combinado). Roda sempre com a consultoria do link (ou da
 * sessão) no {@code TenantContext}: toda consulta já sai filtrada pelo {@code @TenantId}, então plano de outra consultoria
 * nunca aparece nem é aceito. Com o Financeiro desligado não há planos (a página fica só com o texto de "Outro").
 */
@Component
class PlanosDaInscricao {

    /** Mensagem fixa: nunca diz se o id existe em outra consultoria ou está arquivado. */
    static final String PLANO_INVALIDO = "Escolha um dos planos disponíveis.";

    private final PlanoComercialRepository planos;
    private final PagamentosProperties pagamentos;

    PlanosDaInscricao(PlanoComercialRepository planos, PagamentosProperties pagamentos) {
        this.planos = planos;
        this.pagamentos = pagamentos;
    }

    /** Planos ativos na ordem do Financeiro (nome, sem diferença de caixa); o valor só com {@code comPreco}. Só id, nome, periodicidade e preço. */
    List<PlanoDaPagina> ativos(boolean comPreco) {
        if (!pagamentos.habilitado()) return List.of();
        return planos.listar(false).stream()
                .map(p -> new PlanoDaPagina(p.getId(), p.getNome(), periodicidade(p.getPeriodicidade()),
                        comPreco ? p.getValorCentavos() : null))
                .toList();
    }

    /** Sem {@code default}: período novo no Financeiro não compila até ganhar a sua periodicidade aqui (nunca um 500 na página pública). */
    private static Periodicidade periodicidade(PeriodoDoPlano periodo) {
        return switch (periodo) {
            case MENSAL -> Periodicidade.MENSAL;
            case TRIMESTRAL -> Periodicidade.TRIMESTRAL;
            case SEMESTRAL -> Periodicidade.SEMESTRAL;
            case ANUAL -> Periodicidade.ANUAL;
            case PARCELA_UNICA -> Periodicidade.PARCELA_UNICA;
        };
    }

    /** 422 {@code INSCRICAO_INVALIDA} no campo {@code planoComercialId} se o id não é de plano ativo desta consultoria. */
    void exigirAtivo(UUID id) {
        boolean ativo = pagamentos.habilitado() && planos.findById(id).filter(p -> !p.isArquivado()).isPresent();
        if (!ativo) {
            throw new ValidacaoException("Confira os campos.", "INSCRICAO_INVALIDA",
                    List.of(new FieldError("planoComercialId", PLANO_INVALIDO)));
        }
    }

    /** Nomes dos planos (arquivados incluídos: a escolha já foi feita); plano apagado não aparece no mapa. */
    Map<UUID, String> nomes(Collection<UUID> ids) {
        List<UUID> pedidos = ids.stream().filter(java.util.Objects::nonNull).distinct().toList();
        Map<UUID, String> nomes = new HashMap<>(); // mutável: aceita get(null), que o Map.of() recusa
        if (pedidos.isEmpty()) return nomes;
        for (PlanoComercial p : planos.findAllById(pedidos)) nomes.put(p.getId(), p.getNome());
        return nomes;
    }

    /** Nome de um plano (nulo se não há id ou o plano foi apagado). */
    String nome(UUID id) {
        return id == null ? null : nomes(List.of(id)).get(id);
    }
}
