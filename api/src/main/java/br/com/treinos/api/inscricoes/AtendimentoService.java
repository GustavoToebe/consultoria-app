package br.com.treinos.api.inscricoes;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditar;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.inscricoes.Crm.AcaoDaMensagem;
import br.com.treinos.api.inscricoes.Crm.Periodicidade;
import br.com.treinos.api.inscricoes.Crm.TipoEvento;
import br.com.treinos.api.inscricoes.InscricaoDtos.AlunoSemelhante;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoDetalhe;
import br.com.treinos.api.inscricoes.InscricaoDtos.MensagemRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.OrigemRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.PlanoDeReferencia;
import br.com.treinos.api.inscricoes.InscricaoDtos.PropostaRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.RelacaoRequest;
import br.com.treinos.api.inscricoes.InscricaoDtos.Semelhante;
import br.com.treinos.api.inscricoes.InscricaoDtos.Semelhantes;
import br.com.treinos.api.pagamentos.PagamentosProperties;
import br.com.treinos.api.pagamentos.PlanoComercial;
import br.com.treinos.api.pagamentos.PlanoComercialRepository;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/**
 * O atendimento em volta da inscrição: proposta negociada, origem da equipe, "mesma pessoa" e mensagem preparada. Toda
 * alteração confere a versão da inscrição (409 {@code CONFLITO_EDICAO}) e vira evento do histórico. Nada aqui cria
 * cobrança, envia mensagem ou junta inscrições.
 */
@Service
public class AtendimentoService {

    /** Até quantas inscrições semelhantes a consulta devolve. */
    static final int SEMELHANTES = 20;

    private final InscricaoRepository inscricoes;
    private final ModeloDeMensagemRepository modelos;
    private final HistoricoDaInscricao historico;
    private final DetalheDaInscricao detalhes;
    private final PlanoComercialRepository planos;
    private final PagamentosProperties pagamentos;

    public AtendimentoService(InscricaoRepository inscricoes, ModeloDeMensagemRepository modelos,
                              HistoricoDaInscricao historico, DetalheDaInscricao detalhes,
                              PlanoComercialRepository planos, PagamentosProperties pagamentos) {
        this.inscricoes = inscricoes;
        this.modelos = modelos;
        this.historico = historico;
        this.detalhes = detalhes;
        this.planos = planos;
        this.pagamentos = pagamentos;
    }

    // ---- Proposta ----

    /**
     * Planos do Financeiro como referência da proposta (só nome, valor e periodicidade; arquivados ficam de fora). Com o
     * Financeiro desligado, lista vazia: a proposta continua livre.
     */
    @Transactional(readOnly = true)
    public List<PlanoDeReferencia> planosDeReferencia() {
        if (!pagamentos.habilitado()) return List.of();
        return planos.listar(false).stream().map(p -> new PlanoDeReferencia(p.getId(), p.getNome(), p.getValorCentavos(),
                p.getPeriodicidade().name())).toList();
    }

    /**
     * Grava a proposta (cópia dos termos). Com {@code planoId}, nome, periodicidade e valor de referência vêm do plano do
     * Financeiro (o corpo é ignorado nesses três); plano arquivado, de outra consultoria ou com o Financeiro desligado =
     * 404. Tudo nulo apaga a proposta. Depois do aceite não muda mais (409 {@code INSCRICAO_JA_ACEITA}).
     */
    @Transactional
    @Auditar(acao = "INSCRICAO_PROPOSTA_ALTERADA", entidade = "INSCRICAO", resumo = "Alterou a proposta de uma inscrição.")
    public InscricaoDetalhe definirProposta(UUID id, PropostaRequest r, UUID quem) {
        Inscricao i = travar(id);
        InscricaoService.exigirNaoAceita(i);
        InscricaoService.exigirVersao(i, r.versao());
        String nome = Buscas.opcional(r.planoNome());
        Periodicidade periodicidade = r.periodicidade();
        Long referencia = r.valorReferenciaCentavos();
        UUID planoId = r.planoId();
        if (planoId != null) {
            PlanoComercial plano = pagamentos.habilitado() ? planos.findById(planoId).filter(p -> !p.isArquivado())
                    .orElse(null) : null;
            if (plano == null) throw new NaoEncontradoException("Plano não encontrado.");
            nome = plano.getNome();
            periodicidade = Periodicidade.valueOf(plano.getPeriodicidade().name());
            referencia = plano.getValorCentavos();
        }
        i.definirProposta(planoId, nome, r.modalidade(), periodicidade, referencia, r.valorCentavos(),
                Buscas.opcional(r.condicoes()), quem);
        historico.registrar(i, TipoEvento.PROPOSTA, null, null, resumoDaProposta(i), quem);
        return detalhes.detalhe(inscricoes.saveAndFlush(i));
    }

    /** Resumo fixo do evento: "Plano · R$ 1.234,56 · Mensal" com o que houver, ou "Proposta removida". */
    static String resumoDaProposta(Inscricao i) {
        if (!i.temProposta()) return "Proposta removida";
        List<String> partes = new ArrayList<>();
        if (i.getPropostaPlanoNome() != null) partes.add(i.getPropostaPlanoNome());
        if (i.getPropostaValorCentavos() != null) partes.add(Crm.reais(i.getPropostaValorCentavos()));
        else if (i.getPropostaValorReferenciaCentavos() != null) partes.add(Crm.reais(i.getPropostaValorReferenciaCentavos()));
        if (i.getPropostaPeriodicidade() != null) partes.add(rotulo(i.getPropostaPeriodicidade()));
        if (partes.isEmpty()) partes.add("Condições atualizadas");
        String resumo = String.join(" · ", partes);
        return resumo.length() <= 500 ? resumo : resumo.substring(0, 500);
    }

    private static String rotulo(Periodicidade p) {
        return switch (p) {
            case MENSAL -> "Mensal";
            case TRIMESTRAL -> "Trimestral";
            case SEMESTRAL -> "Semestral";
            case ANUAL -> "Anual";
            case PARCELA_UNICA -> "Parcela única";
        };
    }

    // ---- Origem ----

    /** A origem da equipe (corrige a respondida); a respondida e o parâmetro do link nunca mudam. Igual = nada muda. */
    @Transactional
    @Auditar(acao = "INSCRICAO_ORIGEM_ALTERADA", entidade = "INSCRICAO", resumo = "Alterou a origem de uma inscrição.")
    public InscricaoDetalhe alterarOrigem(UUID id, OrigemRequest r, UUID quem) {
        Inscricao i = travar(id);
        InscricaoService.exigirVersao(i, r.versao());
        if (r.origem() == i.getOrigem()) return detalhes.detalhe(i);
        String de = i.getOrigem() == null ? null : i.getOrigem().name();
        i.alterarOrigem(r.origem());
        historico.registrar(i, TipoEvento.ORIGEM, de, r.origem() == null ? null : r.origem().name(), null, quem);
        return detalhes.detalhe(inscricoes.saveAndFlush(i));
    }

    // ---- Mesma pessoa ----

    /**
     * Inscrições (de qualquer situação) com o mesmo e-mail ou WhatsApp e o aluno com o mesmo e-mail. É só possível: duas
     * pessoas podem dividir um contato. O id do aluno só sai para quem vê alunos.
     */
    @Transactional(readOnly = true)
    public Semelhantes semelhantes(UUID id) {
        Inscricao i = inscricoes.findById(id).orElseThrow(InscricaoService::naoEncontrada);
        String email = i.getEmail() == null ? null : i.getEmail().toLowerCase(Locale.ROOT);
        List<Semelhante> lista = inscricoes.semelhantes(i.getId(), email, i.getWhatsapp(), PageRequest.of(0, SEMELHANTES))
                .stream().map(o -> {
                    List<String> coincide = new ArrayList<>();
                    if (email != null && o.getEmail() != null && email.equals(o.getEmail().toLowerCase(Locale.ROOT))) {
                        coincide.add("EMAIL");
                    }
                    if (i.getWhatsapp().equals(o.getWhatsapp())) coincide.add("WHATSAPP");
                    boolean relacionada = o.getId().equals(i.getRelacionadaA()) || i.getId().equals(o.getRelacionadaA());
                    return new Semelhante(o.getId(), o.getNome(), o.getSituacao(), o.getCriadaEm(), coincide, relacionada);
                }).toList();
        AlunoSemelhante aluno = null;
        if (email != null) {
            var alunos = inscricoes.alunosComEmail(List.of(email));
            if (!alunos.isEmpty()) {
                boolean podeVer = AcessoAtual.pode("ALUNO_LER");
                UUID alunoId = alunos.getFirst().id();
                aluno = new AlunoSemelhante(podeVer ? alunoId : null, null);
            }
        }
        return new Semelhantes(lista, aluno);
    }

    /**
     * A equipe confirma que esta inscrição é da mesma pessoa de outra da consultoria: só o vínculo e o evento; nada é
     * juntado nem apagado. Outra inexistente = 404; a própria = 400; a outra já apontando para esta = 409 (sem círculo).
     */
    @Transactional
    @Auditar(acao = "INSCRICAO_RELACIONADA", entidade = "INSCRICAO", resumo = "Marcou duas inscrições como da mesma pessoa.")
    public InscricaoDetalhe relacionar(UUID id, RelacaoRequest r, UUID quem) {
        Inscricao i = travar(id);
        InscricaoService.exigirVersao(i, r.versao());
        if (r.outraId().equals(i.getId())) throw new BadRequestException("Escolha outra inscrição.");
        Inscricao outra = inscricoes.findById(r.outraId()).orElseThrow(InscricaoService::naoEncontrada);
        if (i.getId().equals(outra.getRelacionadaA())) {
            throw new ConflictException("A outra inscrição já está marcada como desta pessoa.", "INSCRICAO_JA_RELACIONADA");
        }
        if (Objects.equals(i.getRelacionadaA(), outra.getId())) return detalhes.detalhe(i);
        i.relacionar(outra.getId());
        historico.registrar(i, TipoEvento.RELACIONADA, null, outra.getId().toString(), null, quem);
        return detalhes.detalhe(inscricoes.saveAndFlush(i));
    }

    @Transactional
    @Auditar(acao = "INSCRICAO_RELACAO_DESFEITA", entidade = "INSCRICAO", resumo = "Desfez a marcação de mesma pessoa de uma inscrição.")
    public InscricaoDetalhe desfazerRelacao(UUID id, long versao, UUID quem) {
        Inscricao i = travar(id);
        InscricaoService.exigirVersao(i, versao);
        if (i.getRelacionadaA() == null) return detalhes.detalhe(i);
        String de = i.getRelacionadaA().toString();
        i.relacionar(null);
        historico.registrar(i, TipoEvento.RELACAO_DESFEITA, de, null, null, quem);
        return detalhes.detalhe(inscricoes.saveAndFlush(i));
    }

    // ---- Mensagem preparada ----

    /**
     * Registra que uma mensagem foi preparada (copiada ou WhatsApp aberto). O texto não vem para a API; o evento guarda
     * só o nome do modelo. Nunca "enviada": o app não sabe se a pessoa mandou. Não sobe a versão (renova a atividade).
     */
    @Transactional
    public void mensagemPreparada(UUID id, MensagemRequest r, UUID quem) {
        historico.atividade(id);
        Inscricao i = inscricoes.findById(id).orElseThrow(InscricaoService::naoEncontrada);
        String modelo = r.modeloId() == null ? "Mensagem livre"
                : modelos.findById(r.modeloId()).map(ModeloDeMensagem::getNome).orElse("Mensagem livre");
        AcaoDaMensagem acao = r.acao();
        historico.registrar(i, TipoEvento.MENSAGEM_PREPARADA, null, acao.name(), modelo, quem);
    }

    private Inscricao travar(UUID id) {
        return inscricoes.buscarParaAlterar(id).orElseThrow(InscricaoService::naoEncontrada);
    }
}
