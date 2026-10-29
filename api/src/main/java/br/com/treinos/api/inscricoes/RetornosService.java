package br.com.treinos.api.inscricoes;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.inscricoes.Crm.TipoEvento;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoDetalhe;
import br.com.treinos.api.inscricoes.InscricaoDtos.RetornoPendente;
import br.com.treinos.api.inscricoes.InscricaoDtos.RetornoRequest;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import br.com.plataforma.comum.web.ApiError.FieldError;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Retornos (próxima ação) das inscrições: marcar, reagendar e concluir. Só inscrição em atendimento recebe retorno novo
 * (409 {@code INSCRICAO_ENCERRADA}); o retorno tem a própria versão (409 {@code CONFLITO_EDICAO}). Marcar, reagendar e
 * concluir renovam a atividade da inscrição (sem subir a versão dela) e viram evento. Só aparecem na tela: nada de
 * notificação.
 */
@Service
public class RetornosService {

    /** A lista "Retornos" mostra até tantos pendentes. */
    static final int PENDENTES = 100;
    private static final DateTimeFormatter DIA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final InscricaoRepository inscricoes;
    private final InscricaoRetornoRepository retornos;
    private final ResponsaveisDaInscricao responsaveis;
    private final HistoricoDaInscricao historico;
    private final DetalheDaInscricao detalhes;

    public RetornosService(InscricaoRepository inscricoes, InscricaoRetornoRepository retornos,
                           ResponsaveisDaInscricao responsaveis, HistoricoDaInscricao historico,
                           DetalheDaInscricao detalhes) {
        this.inscricoes = inscricoes;
        this.retornos = retornos;
        this.responsaveis = responsaveis;
        this.historico = historico;
        this.detalhes = detalhes;
    }

    /** Pendentes das inscrições em atendimento, do mais antigo ao mais novo ({@code meus} = os retornos com quem pede). */
    @Transactional(readOnly = true)
    public List<RetornoPendente> pendentes(UUID meus) {
        List<InscricaoRetorno> lista = retornos.pendentes(SituacaoInscricao.ABERTAS, meus, PageRequest.of(0, PENDENTES));
        if (lista.isEmpty()) return List.of();
        Map<UUID, Inscricao> porId = inscricoes.findAllById(lista.stream().map(InscricaoRetorno::getInscricaoId).distinct()
                .toList()).stream().collect(Collectors.toMap(Inscricao::getId, Function.identity()));
        List<UUID> pessoas = new ArrayList<>();
        lista.forEach(r -> pessoas.add(r.getResponsavelId()));
        Map<UUID, String> nomes = responsaveis.nomes(pessoas);
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        return lista.stream().filter(r -> porId.containsKey(r.getInscricaoId())).map(r -> {
            Inscricao i = porId.get(r.getInscricaoId());
            return new RetornoPendente(r.getId(), r.getDescricao(), r.getData(), r.getResponsavelId(),
                    nomes.get(r.getResponsavelId()), null, null, r.getCriadoEm(), r.getVersao(), i.getId(), i.getNome(),
                    i.getSituacao(), r.getData().isBefore(hoje));
        }).toList();
    }

    @Transactional
    public InscricaoDetalhe marcar(UUID inscricaoId, RetornoRequest r, UUID quem) {
        historico.atividade(inscricaoId);
        Inscricao i = inscricoes.findById(inscricaoId).orElseThrow(InscricaoService::naoEncontrada);
        exigirEmAtendimento(i);
        validarData(r.data());
        UUID responsavel = responsaveis.exigirValido(r.responsavelId());
        InscricaoRetorno novo = retornos.saveAndFlush(new InscricaoRetorno(i.getId(), r.descricao().trim(), r.data(),
                responsavel, quem));
        historico.registrar(i, TipoEvento.RETORNO_MARCADO, null, novo.getData().toString(), resumo(novo), quem);
        return detalhes.detalhe(i);
    }

    /** Reagendar ou corrigir (descrição, data, responsável), com a versão do retorno; concluído não muda mais. */
    @Transactional
    public InscricaoDetalhe alterar(UUID retornoId, RetornoRequest r, UUID quem) {
        InscricaoRetorno atual = retornos.findById(retornoId).orElseThrow(RetornosService::naoEncontrado);
        historico.atividade(atual.getInscricaoId());
        InscricaoRetorno retorno = retornos.buscarParaAlterar(retornoId).orElseThrow(RetornosService::naoEncontrado);
        exigirVersao(retorno, r.versao());
        if (!retorno.pendente()) {
            throw new ConflictException("Este retorno já foi concluído.", "RETORNO_CONCLUIDO");
        }
        Inscricao i = inscricoes.findById(retorno.getInscricaoId()).orElseThrow(InscricaoService::naoEncontrada);
        exigirEmAtendimento(i);
        validarData(r.data());
        UUID responsavel = Objects.equals(r.responsavelId(), retorno.getResponsavelId()) ? retorno.getResponsavelId()
                : responsaveis.exigirValido(r.responsavelId());
        String de = retorno.getData().toString();
        retorno.alterar(r.descricao().trim(), r.data(), responsavel);
        retornos.saveAndFlush(retorno);
        historico.registrar(i, TipoEvento.RETORNO_ALTERADO, de, retorno.getData().toString(), resumo(retorno), quem);
        return detalhes.detalhe(i);
    }

    /** Concluir é idempotente para o mesmo retorno (já concluído devolve o detalhe sem mudar nada). */
    @Transactional
    public InscricaoDetalhe concluir(UUID retornoId, long versao, UUID quem) {
        InscricaoRetorno atual = retornos.findById(retornoId).orElseThrow(RetornosService::naoEncontrado);
        historico.atividade(atual.getInscricaoId());
        InscricaoRetorno retorno = retornos.buscarParaAlterar(retornoId).orElseThrow(RetornosService::naoEncontrado);
        Inscricao i = inscricoes.findById(retorno.getInscricaoId()).orElseThrow(InscricaoService::naoEncontrada);
        if (!retorno.pendente()) return detalhes.detalhe(i);
        exigirVersao(retorno, versao);
        retorno.concluir(quem);
        retornos.saveAndFlush(retorno);
        historico.registrar(i, TipoEvento.RETORNO_CONCLUIDO, null, null, resumo(retorno), quem);
        return detalhes.detalhe(i);
    }

    /** "DD/MM/AAAA · descrição" (até 500). */
    private static String resumo(InscricaoRetorno r) {
        String texto = r.getData().format(DIA) + " · " + r.getDescricao();
        return texto.length() <= 500 ? texto : texto.substring(0, 500);
    }

    private static void exigirEmAtendimento(Inscricao i) {
        if (!i.getSituacao().aberta()) {
            throw new ConflictException("Retorno só em inscrição em atendimento. Reabra o atendimento antes.",
                    "INSCRICAO_ENCERRADA");
        }
    }

    /** Data entre um ano atrás e dois anos à frente (Brasília): fora disso é engano de digitação. */
    private static void validarData(LocalDate data) {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        if (data.isBefore(hoje.minusYears(1)) || data.isAfter(hoje.plusYears(2))) {
            throw new ValidacaoException("Confira a data do retorno.", "RETORNO_INVALIDO",
                    List.of(new FieldError("data", "Use uma data entre um ano atrás e dois anos à frente.")));
        }
    }

    private static void exigirVersao(InscricaoRetorno r, Long versao) {
        if (versao == null || !versao.equals(r.getVersao())) {
            throw new ConflictException("Outra pessoa ou aba alterou este retorno. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }

    private static NaoEncontradoException naoEncontrado() {
        return new NaoEncontradoException("Retorno não encontrado.");
    }
}
