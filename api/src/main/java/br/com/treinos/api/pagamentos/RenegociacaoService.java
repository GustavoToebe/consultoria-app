package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.plataforma.comum.web.ResourceNotFoundException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.PagamentosDtos.AcordoDesfeito;
import br.com.treinos.api.pagamentos.PagamentosDtos.DesfazerAcordoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.ItemDaRenegociacao;
import br.com.treinos.api.pagamentos.PagamentosDtos.ParcelaDaPreviaDaRenegociacao;
import br.com.treinos.api.pagamentos.PagamentosDtos.PreviaDaRenegociacao;
import br.com.treinos.api.pagamentos.PagamentosDtos.PreviaDaRenegociacaoRequest;
import br.com.treinos.api.pagamentos.PagamentosDtos.RenegociacaoResponse;
import br.com.treinos.api.pagamentos.PagamentosDtos.RenegociarRequest;
import br.com.treinos.api.web.FaixaDeData;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Renegociar cobranças (D14, V094): 1 a {@value #MAXIMO_DE_ITENS} cobranças ABERTAS (vencidas incluídas, MENSALIDADE ou AVULSA) do MESMO
 * aluno viram um acordo em 1 a {@value #MAXIMO_DE_PARCELAS} parcelas. É a terceira exceção à regra "o valor da cobrança é do servidor"
 * (ao lado da saída {@code OUTRO} e da avulsa): o total é a soma LIDA NO BANCO mais o acréscimo e menos o desconto do corpo. As originais
 * viram RENEGOCIADA (continuam cobrindo a competência) e nascem N cobranças RENEGOCIACAO com descrição fixa do servidor.
 *
 * <p>A prévia faz as mesmas conferências do confirmar, sem travar nem gravar. O confirmar é tudo ou nada, na ordem de trava do
 * financeiro (aluno, depois as cobranças em ordem de id), e idempotente pelo {@code pedidoId} (guardado no acordo): repetir devolve o
 * corpo de antes em 200, sem gravar, sem auditar e sem reconferir situação nem versão. Recusas: 422 {@code RENEGOCIACAO_INVALIDA}
 * por campo (sem repetir valor nem texto), 404 (cobrança inexistente ou de outra consultoria, sem distinguir), 409
 * {@code COBRANCAS_DE_ALUNOS_DIFERENTES}, {@code ALUNO_ANONIMIZADO}, {@code ALUNO_INATIVO}, {@code COBRANCA_NAO_ABERTA},
 * {@code COBRANCA_NAO_RENEGOCIAVEL} (saída ou parcela de acordo), {@code RENEGOCIACAO_COBRANCA_AUTOMATICA} (D3: mensalidade que a
 * Kiwify cobra; uma só no lote recusa o lote inteiro) e {@code CONFLITO_EDICAO}. O {@code motivo} é texto do treinador: fica nas
 * originais (e sai na exportação do aluno, direito de acesso) e nunca vai a log, auditoria, aluno (telas e rotas) nem provedor. Auditoria com resumo fixo ({@code COBRANCAS_RENEGOCIADAS},
 * {@code ACORDO_DESFEITO}).
 */
@Service
public class RenegociacaoService {

    public static final int MAXIMO_DE_ITENS = 100;
    public static final int MAXIMO_DE_PARCELAS = 12;
    public static final int MAXIMO_DO_MOTIVO = 300;
    private static final String CODIGO = "RENEGOCIACAO_INVALIDA";

    private final CobrancaAlunoRepository cobrancas;
    private final AcordoDeCobrancaRepository acordos;
    private final AlunoRepository alunos;
    private final Auditoria auditoria;
    private final CobrancaAutomatica automatica;
    private final PagamentosDoAluno pagamentos;

    public RenegociacaoService(CobrancaAlunoRepository cobrancas, AcordoDeCobrancaRepository acordos, AlunoRepository alunos,
                               Auditoria auditoria, CobrancaAutomatica automatica, PagamentosDoAluno pagamentos) {
        this.cobrancas = cobrancas;
        this.acordos = acordos;
        this.alunos = alunos;
        this.auditoria = auditoria;
        this.automatica = automatica;
        this.pagamentos = pagamentos;
    }

    /** {@code repetido}: o pedido já tinha sido feito e {@code resposta} é o que ele fez na primeira vez (200 em vez de 201). */
    public record Resultado(RenegociacaoResponse resposta, boolean repetido) { }

    /** As originais já conferidas, na ordem do pedido, e a conta. */
    private record Conferida(Aluno aluno, List<CobrancaAluno> originais, PreviaDaRenegociacao previa) { }

    @Transactional(readOnly = true)
    public PreviaDaRenegociacao previa(PreviaDaRenegociacaoRequest r) {
        conferirCorpo(r, false, null, null);
        return conferir(r, alvo(r, false), false).previa();
    }

    @Transactional
    public Resultado confirmar(RenegociarRequest r) {
        String motivo = r.motivo() == null ? null : r.motivo().strip();
        conferirCorpo(r.previa(), true, r.pedidoId(), motivo);
        // Repetição (idempotência): devolve o que o pedido já fez, sem comparar o corpo. Fica antes das conferências de estado (as
        // originais já não estão abertas nem o aluno precisa estar ativo) e é refeita logo depois da trava do aluno, para a segunda de
        // duas chamadas simultâneas enxergar a primeira (a consulta vai de novo ao banco, em READ COMMITTED).
        var jaFeito = acordos.findByPedidoId(r.pedidoId());
        if (jaFeito.isPresent()) {
            return repetido(jaFeito.get());
        }
        Alvo alvo = alvo(r.previa(), true);
        jaFeito = acordos.findByPedidoId(r.pedidoId());
        if (jaFeito.isPresent()) {
            return repetido(jaFeito.get());
        }
        Conferida c = conferir(r.previa(), alvo, true);
        var previa = c.previa();
        AcordoDeCobranca acordo;
        try {
            acordo = acordos.saveAndFlush(new AcordoDeCobranca(c.aluno().getId(), r.pedidoId(), c.originais().size(),
                    previa.parcelas().size(), previa.totalCentavos()));
        } catch (DataIntegrityViolationException e) {
            // Outro aluno confirmou o mesmo pedido ao mesmo tempo (o aluno travado é outro, então a segunda checagem não o viu). O
            // Postgres aborta a transação: não dá para reler aqui, então 409 e a nova tentativa cai na checagem do começo.
            if (ContratacaoService.violou(e, "ux_acordo_pedido")) {
                throw new ConflictException("Outra renegociação com este pedido acabou de ser feita. Recarregue e confira.",
                        "CONFLITO_EDICAO");
            }
            throw e;
        }
        c.originais().forEach(o -> o.renegociar(acordo.getId(), motivo));
        List<CobrancaAluno> novas = previa.parcelas().stream().map(p -> CobrancaAluno.renegociacao(acordo.getId(),
                c.aluno().getId(), p.descricao(), p.valorCentavos(), p.vencimento())).toList();
        cobrancas.saveAll(novas);
        cobrancas.flush();
        pagamentos.reativarSeQuitou(c.aluno(), false);
        auditoria.registrarEvento("COBRANCAS_RENEGOCIADAS", "ACORDO", acordo.getId(), "Renegociou cobranças de um aluno em parcelas.");
        return new Resultado(new RenegociacaoResponse(acordo.getId(), c.originais().size(), novas.size(), previa.totalCentavos()), false);
    }

    private static Resultado repetido(AcordoDeCobranca a) {
        return new Resultado(new RenegociacaoResponse(a.getId(), a.getRenegociadas(), a.getParcelas(), a.getTotalCentavos()), true);
    }

    /**
     * Desfazer: só se nenhuma parcela foi paga, contestada ou estornada. As originais voltam a ABERTA (versão nova, sem acordo) e as
     * parcelas ainda abertas viram CANCELADA com o motivo (as que já estavam canceladas ficam como estão). Acordo de outra consultoria ou
     * inexistente é 404; já desfeito, 409 {@code ACORDO_JA_DESFEITO}; aluno inativo ou anonimizado, 409 como no resto do financeiro.
     */
    @Transactional
    public AcordoDesfeito desfazer(UUID acordoId, DesfazerAcordoRequest r) {
        String motivo = r.motivo() == null ? null : r.motivo().strip();
        List<ApiError.FieldError> erros = new ArrayList<>();
        conferirMotivo(motivo, erros);
        lancar(erros);
        UUID alunoId = acordos.alunoDe(acordoId).orElseThrow(RenegociacaoService::acordoNaoEncontrado);
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(Travas::alunoNaoEncontrado);
        exigirAlunoAtivo(aluno);
        AcordoDeCobranca acordo = acordos.findById(acordoId).orElseThrow(RenegociacaoService::acordoNaoEncontrado);
        if (acordo.getDesfeitoEm() != null) {
            throw new ConflictException("Este acordo já foi desfeito.", "ACORDO_JA_DESFEITO");
        }
        if (acordo.getContratacaoId() != null) {
            // O acordo de parcelas de um contrato fechado (V098) acaba com o contrato, não se desfaz por aqui.
            throw new ConflictException("O acordo de parcelas de um contrato não pode ser desfeito.", "ACORDO_NAO_DESFAZIVEL");
        }
        List<CobrancaAluno> doAcordo = cobrancas.travarDoAcordo(acordoId);
        List<CobrancaAluno> parcelas = doAcordo.stream().filter(c -> c.getTipo() == CobrancaAluno.Tipo.RENEGOCIACAO).toList();
        if (parcelas.stream().anyMatch(p -> p.getSituacao() == CobrancaAluno.Situacao.PAGA
                || p.getSituacao() == CobrancaAluno.Situacao.CONTESTADA || p.getSituacao() == CobrancaAluno.Situacao.ESTORNADA)) {
            throw new ConflictException("Alguma parcela do acordo já foi paga, contestada ou estornada: não dá para desfazer.",
                    "ACORDO_NAO_DESFAZIVEL");
        }
        List<CobrancaAluno> originais = doAcordo.stream().filter(c -> c.getSituacao() == CobrancaAluno.Situacao.RENEGOCIADA).toList();
        originais.forEach(CobrancaAluno::reabrirDoAcordo);
        List<CobrancaAluno> abertas = parcelas.stream().filter(p -> p.getSituacao() == CobrancaAluno.Situacao.ABERTA).toList();
        abertas.forEach(p -> p.cancelar(motivo));
        acordo.desfazer(Instant.now());
        cobrancas.flush();
        acordos.flush();
        auditoria.registrarEvento("ACORDO_DESFEITO", "ACORDO", acordoId, "Desfez um acordo de renegociação.");
        return new AcordoDesfeito(acordoId, originais.size(), abertas.size());
    }

    // ---- conferências ----

    /** O aluno das cobranças pedidas (travado só no confirmar) e os ids, na ordem do pedido. */
    private record Alvo(Aluno aluno, List<UUID> ids) { }

    /**
     * Primeira metade das conferências: cobrança que não existe (404) e alunos diferentes (409); depois o aluno é lido (no confirmar, com
     * trava: a primeira da ordem do financeiro). Se o aluno está inativo ou anonimizado, quem decide é {@link #conferir}.
     */
    private Alvo alvo(PreviaDaRenegociacaoRequest r, boolean travar) {
        List<UUID> ids = r.itens().stream().map(ItemDaRenegociacao::cobrancaId).toList();
        List<CobrancaAlunoRepository.Dono> donos = cobrancas.donosDe(ids);
        if (donos.size() != ids.size()) {
            throw cobrancaNaoEncontrada();
        }
        Set<UUID> alunosDasCobrancas = new HashSet<>();
        donos.forEach(d -> alunosDasCobrancas.add(d.getAlunoId()));
        if (alunosDasCobrancas.size() > 1) {
            throw new ConflictException("Escolha cobranças de um aluno só.", "COBRANCAS_DE_ALUNOS_DIFERENTES");
        }
        UUID alunoId = alunosDasCobrancas.iterator().next();
        Aluno aluno = (travar ? alunos.buscarParaAlterar(alunoId) : alunos.findById(alunoId)).orElseThrow(Travas::alunoNaoEncontrado);
        return new Alvo(aluno, ids);
    }

    /**
     * Segunda metade, na ordem: aluno anonimizado ou inativo (409), depois cada original na ordem do pedido (não aberta, não
     * renegociável, versão; as originais são travadas numa consulta só, em ordem de id, no confirmar) e por fim a conta (desconto que
     * zera o total, 422).
     */
    private Conferida conferir(PreviaDaRenegociacaoRequest r, Alvo alvo, boolean travar) {
        exigirAlunoAtivo(alvo.aluno());
        Map<UUID, CobrancaAluno> doBanco = new HashMap<>();
        (travar ? cobrancas.travarPorIds(alvo.ids()) : cobrancas.findAllById(alvo.ids())).forEach(c -> doBanco.put(c.getId(), c));
        Set<UUID> automaticas = automatica.contratacoesAutomaticas(doBanco.values());
        List<CobrancaAluno> originais = new ArrayList<>(alvo.ids().size());
        long soma = 0;
        for (ItemDaRenegociacao item : r.itens()) {
            CobrancaAluno c = doBanco.get(item.cobrancaId());
            if (c == null) {
                throw cobrancaNaoEncontrada();
            }
            if (c.getSituacao() != CobrancaAluno.Situacao.ABERTA) {
                throw new ConflictException("Alguma cobrança não está em aberto.", "COBRANCA_NAO_ABERTA");
            }
            // A entrada e os pagamentos do saldo de um contrato fechado (AVULSA ligada à contratação, V098) também não: o contrato
            // tem a sua própria conta e renegociar tiraria a cobrança do total.
            if ((c.getTipo() != CobrancaAluno.Tipo.MENSALIDADE && c.getTipo() != CobrancaAluno.Tipo.AVULSA)
                    || (c.getTipo() == CobrancaAluno.Tipo.AVULSA && c.getContratacaoId() != null)) {
                throw new ConflictException("A cobrança de saída, a parcela de um acordo e a cobrança de um contrato não se renegociam.",
                        "COBRANCA_NAO_RENEGOCIAVEL");
            }
            if (CobrancaAutomatica.eh(c, automaticas)) { // D3: uma só recusa o lote inteiro; nada foi gravado até aqui
                throw new ConflictException("Esta cobrança é cobrada automaticamente pela Kiwify e não pode ser renegociada.",
                        "RENEGOCIACAO_COBRANCA_AUTOMATICA");
            }
            if (!item.versao().equals(c.getVersao())) {
                throw new ConflictException("Outra pessoa ou aba alterou uma das cobranças. Recarregue para ver a versão atual.",
                        "CONFLITO_EDICAO");
            }
            soma = Math.addExact(soma, c.getValorCentavos());
            originais.add(c);
        }
        long total = soma + r.acrescimoCentavos() - r.descontoCentavos();
        if (total < r.parcelas()) {
            throw new ValidacaoException("Confira os dados da renegociação.", CODIGO, List.of(new ApiError.FieldError(
                    "descontoCentavos", "O desconto não pode zerar o total: cada parcela precisa ficar com 1 centavo ou mais.")));
        }
        List<ParcelaDaPreviaDaRenegociacao> parcelas = ContaDaRenegociacao.parcelas(total, r.parcelas(), r.primeiroVencimento());
        // A maior parcela é a última (leva a sobra dos centavos): o teto de valor do financeiro vale para cada parcela.
        if (parcelas.get(parcelas.size() - 1).valorCentavos() > PagamentosDtos.VALOR_MAXIMO) {
            String mensagem = "Cada parcela pode ir até R$ 10.000.000,00: aumente o desconto ou o número de parcelas.";
            throw new ValidacaoException("Confira os dados da renegociação.", CODIGO, List.of(
                    new ApiError.FieldError("descontoCentavos", mensagem), new ApiError.FieldError("parcelas", mensagem)));
        }
        return new Conferida(alvo.aluno(), originais, new PreviaDaRenegociacao(alvo.aluno().getId(), originais.size(), soma,
                r.acrescimoCentavos(), r.descontoCentavos(), total, parcelas));
    }

    private static void exigirAlunoAtivo(Aluno aluno) {
        AlunoService.exigirNaoAnonimizado(aluno);
        if (!aluno.isAtivo()) {
            throw new ConflictException("Este aluno está inativo; reative-o para renegociar.", "ALUNO_INATIVO");
        }
    }

    /** 404 com o código do contrato do app; o mesmo para a que não existe e a de outra consultoria (nunca revela qual). */
    private static ResourceNotFoundException cobrancaNaoEncontrada() {
        return new ResourceNotFoundException("Cobrança não encontrada.", "COBRANCA_NAO_ENCONTRADA");
    }

    private static NaoEncontradoException acordoNaoEncontrado() {
        return new NaoEncontradoException("Acordo não encontrado.");
    }

    /** 422 com um erro por campo; nenhuma mensagem repete o que a pessoa digitou. {@code pedidoId} só é conferido no confirmar. */
    private static void conferirCorpo(PreviaDaRenegociacaoRequest r, boolean confirmar, UUID pedidoId, String motivo) {
        List<ApiError.FieldError> erros = new ArrayList<>();
        List<ItemDaRenegociacao> itens = r.itens();
        if (itens == null || itens.isEmpty() || itens.size() > MAXIMO_DE_ITENS) {
            erros.add(new ApiError.FieldError("itens", "Escolha de 1 a " + MAXIMO_DE_ITENS + " cobranças."));
        } else {
            Set<UUID> vistos = new HashSet<>();
            boolean repetido = false;
            for (int i = 0; i < itens.size(); i++) {
                ItemDaRenegociacao item = itens.get(i);
                if (item == null || item.cobrancaId() == null || item.versao() == null) {
                    erros.add(new ApiError.FieldError("itens[" + i + "]", "Cobrança inválida."));
                } else if (!vistos.add(item.cobrancaId())) {
                    repetido = true;
                }
            }
            if (repetido) {
                erros.add(new ApiError.FieldError("itens", "Há cobrança repetida na lista."));
            }
        }
        conferirAjuste(erros, "acrescimoCentavos", r.acrescimoCentavos(), "Acréscimo");
        conferirAjuste(erros, "descontoCentavos", r.descontoCentavos(), "Desconto");
        if (r.parcelas() == null || r.parcelas() < 1 || r.parcelas() > MAXIMO_DE_PARCELAS) {
            erros.add(new ApiError.FieldError("parcelas", "Escolha de 1 a " + MAXIMO_DE_PARCELAS + " parcelas."));
        }
        if (r.primeiroVencimento() == null) {
            erros.add(new ApiError.FieldError("primeiroVencimento", "Informe o primeiro vencimento."));
        } else {
            erros.addAll(FaixaDeData.problemas(FaixaDeData.hoje(),
                    FaixaDeData.PLANEJAMENTO.campo("primeiroVencimento", "Primeiro vencimento", r.primeiroVencimento())));
        }
        if (confirmar) {
            if (pedidoId == null) {
                erros.add(new ApiError.FieldError("pedidoId", "Informe o identificador do pedido."));
            }
            conferirMotivo(motivo, erros);
        }
        lancar(erros);
    }

    private static void conferirMotivo(String motivo, List<ApiError.FieldError> erros) {
        if (motivo == null || motivo.isEmpty() || motivo.length() > MAXIMO_DO_MOTIVO) {
            erros.add(new ApiError.FieldError("motivo", "Informe o motivo, até " + MAXIMO_DO_MOTIVO + " caracteres."));
        }
    }

    private static void conferirAjuste(List<ApiError.FieldError> erros, String campo, Long valor, String rotulo) {
        if (valor == null || valor < 0 || valor > PagamentosDtos.VALOR_MAXIMO) {
            erros.add(new ApiError.FieldError(campo, rotulo + ": informe de R$ 0,00 a R$ 10.000.000,00."));
        }
    }

    private static void lancar(List<ApiError.FieldError> erros) {
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira os dados da renegociação.", CODIGO, erros);
        }
    }
}
