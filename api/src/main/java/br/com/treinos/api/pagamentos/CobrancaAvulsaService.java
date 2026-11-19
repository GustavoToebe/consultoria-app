package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.PagamentosDtos.CobrancaAvulsaRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.CobrancasAvulsasGeradas;
import br.com.treinos.api.web.FaixaDeData;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Cobrança avulsa (V087): o treinador lança uma cobrança direto a 1 a {@value #MAXIMO_DE_ALUNOS} alunos, em 1 a
 * {@value #MAXIMO_DE_PARCELAS} parcelas mensais, sem contratação. Tudo ou nada, numa transação. É a segunda exceção à regra "o valor
 * da cobrança é do servidor" (a primeira é a saída {@code OUTRO}): valor e descrição vêm do corpo e são conferidos aqui, em 422
 * {@code COBRANCA_AVULSA_INVALIDA} com um erro por campo e sem repetir o valor recebido. Os alunos são travados (ordem de id, a
 * primeira trava da ordem do financeiro) antes de gravar; de outra consultoria ou inexistente é 404, anonimizado 409
 * {@code ALUNO_ANONIMIZADO} e inativo 409 {@code ALUNO_INATIVO}, como no resto do financeiro. Auditoria: um evento
 * {@code COBRANCAS_AVULSAS_GERADAS} por aluno ({@code entidadeId} = id do aluno), com resumo fixo (sem valor, nome nem descrição).
 * Idempotente por {@code pedidoId} (D11, V090, obrigatório): ver {@link #gerar}.
 */
@Service
public class CobrancaAvulsaService {

    public static final int MAXIMO_DE_ALUNOS = 100;
    public static final int MAXIMO_DE_PARCELAS = 12;
    public static final int MAXIMO_DA_DESCRICAO = 120;

    private final CobrancaAlunoRepository cobrancas;
    private final AlunoRepository alunos;
    private final Auditoria auditoria;

    public CobrancaAvulsaService(CobrancaAlunoRepository cobrancas, AlunoRepository alunos, Auditoria auditoria) {
        this.cobrancas = cobrancas;
        this.alunos = alunos;
        this.auditoria = auditoria;
    }

    /** {@code repetido}: o pedido já tinha sido gerado e {@code geradas} é o que ele gerou na primeira vez (200 em vez de 201). */
    public record Resultado(CobrancasAvulsasGeradas geradas, boolean repetido) { }

    @Transactional
    public Resultado gerar(CobrancaAvulsaRequest r) {
        String descricao = r.descricao() == null ? null : r.descricao().strip();
        conferir(r, descricao);
        List<UUID> ids = r.alunoIds();
        Map<UUID, Aluno> doBanco = new HashMap<>();
        alunos.buscarParaAlterarVarios(ids).forEach(a -> doBanco.put(a.getId(), a));
        // D11: o pedido repetido devolve o que já foi gerado, sem comparar o corpo (outros alunos ou valor são ignorados), sem gravar nem
        // auditar. Fica DEPOIS da trava dos alunos: a segunda de duas chamadas simultâneas espera a primeira terminar e a enxerga aqui
        // (READ COMMITTED), então a unique ux_cobranca_avulsa_pedido nunca estoura por corrida do mesmo aluno. O @TenantId isola o UUID.
        CobrancaAlunoRepository.DoPedido jaGerado = cobrancas.doPedido(r.pedidoId());
        if (jaGerado.getCobrancas() > 0) {
            return new Resultado(new CobrancasAvulsasGeradas(jaGerado.getAlunos().intValue(), jaGerado.getCobrancas().intValue()), true);
        }
        for (UUID id : ids) {
            Aluno aluno = doBanco.get(id);
            if (aluno == null) {
                throw Travas.alunoNaoEncontrado();
            }
            AlunoService.exigirNaoAnonimizado(aluno);
            if (!aluno.isAtivo()) {
                throw new ConflictException("Um dos alunos está inativo; reative-o ou tire-o da lista.", "ALUNO_INATIVO");
            }
        }
        int parcelas = r.parcelas();
        List<CobrancaAluno> novas = new ArrayList<>(ids.size() * parcelas);
        for (UUID id : ids) {
            for (int k = 1; k <= parcelas; k++) {
                // Cada vencimento parte do primeiro (não do anterior): o dia 31 volta ao 31 nos meses que o têm.
                novas.add(CobrancaAluno.avulsa(r.pedidoId(), id, k, parcelas > 1 ? descricao + " (Parcela " + k + "/" + parcelas + ")" : descricao,
                        r.valorCentavos(), r.primeiroVencimento().plusMonths(k - 1L)));
            }
        }
        cobrancas.saveAll(novas);
        cobrancas.flush();
        // Um evento por aluno (o rastro de quem foi cobrado), na mesma transação, com resumo fixo: sem valor, nome nem descrição.
        for (UUID id : ids) {
            auditoria.registrarEvento("COBRANCAS_AVULSAS_GERADAS", "ALUNO", id, "Gerou cobranças avulsas para o aluno.");
        }
        return new Resultado(new CobrancasAvulsasGeradas(ids.size(), novas.size()), false);
    }

    /** 422 com um erro por campo; nenhuma mensagem repete o que a pessoa digitou. */
    private static void conferir(CobrancaAvulsaRequest r, String descricao) {
        List<ApiError.FieldError> erros = new ArrayList<>();
        if (r.pedidoId() == null) {
            erros.add(new ApiError.FieldError("pedidoId", "Informe o identificador do pedido."));
        }
        List<UUID> ids = r.alunoIds();
        if (ids == null || ids.isEmpty() || ids.size() > MAXIMO_DE_ALUNOS) {
            erros.add(new ApiError.FieldError("alunoIds", "Escolha de 1 a " + MAXIMO_DE_ALUNOS + " alunos."));
        } else {
            Set<UUID> vistos = new HashSet<>();
            for (int i = 0; i < ids.size(); i++) {
                if (ids.get(i) == null) {
                    erros.add(new ApiError.FieldError("alunoIds[" + i + "]", "Aluno inválido."));
                } else if (!vistos.add(ids.get(i))) {
                    erros.add(new ApiError.FieldError("alunoIds[" + i + "]", "Aluno repetido na lista."));
                }
            }
        }
        if (descricao == null || descricao.isEmpty()) {
            erros.add(new ApiError.FieldError("descricao", "Informe a descrição."));
        } else if (descricao.length() > MAXIMO_DA_DESCRICAO) {
            erros.add(new ApiError.FieldError("descricao", "A descrição pode ter até " + MAXIMO_DA_DESCRICAO + " caracteres."));
        }
        if (r.valorCentavos() == null || r.valorCentavos() < 1 || r.valorCentavos() > PagamentosDtos.VALOR_MAXIMO) {
            erros.add(new ApiError.FieldError("valorCentavos", "Informe um valor maior que zero, até R$ 10.000.000,00."));
        }
        if (r.primeiroVencimento() == null) {
            erros.add(new ApiError.FieldError("primeiroVencimento", "Informe o primeiro vencimento."));
        } else {
            LocalDate hoje = FaixaDeData.hoje();
            erros.addAll(FaixaDeData.problemas(hoje,
                    FaixaDeData.PLANEJAMENTO.campo("primeiroVencimento", "Primeiro vencimento", r.primeiroVencimento())));
        }
        if (r.parcelas() == null || r.parcelas() < 1 || r.parcelas() > MAXIMO_DE_PARCELAS) {
            erros.add(new ApiError.FieldError("parcelas", "Escolha de 1 a " + MAXIMO_DE_PARCELAS + " parcelas."));
        }
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira os dados da cobrança.", "COBRANCA_AVULSA_INVALIDA", erros);
        }
    }
}
