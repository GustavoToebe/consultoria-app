package br.com.treinos.api.inscricoes;

import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.inscricoes.Crm.MotivoEncerramento;
import br.com.treinos.api.inscricoes.InscricaoDtos.Duplicidade;
import br.com.treinos.api.inscricoes.InscricaoDtos.Evento;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoDetalhe;
import br.com.treinos.api.inscricoes.InscricaoDtos.InscricaoResumo;
import br.com.treinos.api.inscricoes.InscricaoDtos.Nota;
import br.com.treinos.api.inscricoes.InscricaoDtos.ProximoRetorno;
import br.com.treinos.api.inscricoes.InscricaoDtos.Proposta;
import br.com.treinos.api.inscricoes.InscricaoDtos.Relacionada;
import br.com.treinos.api.inscricoes.InscricaoDtos.Retorno;
import br.com.treinos.api.web.Fuso;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Monta o detalhe e os resumos da fila (chamado dentro da transação de quem lê ou altera). Sempre poucas consultas por
 * página, nunca uma por linha. Objetivo e observação da inscrição aceita seguem as regras do aluno (só com
 * {@code ALUNO_SENSIVEL_LER}); o id do aluno só sai para quem vê alunos.
 */
@Component
class DetalheDaInscricao {

    /** O detalhe leva até tantos eventos e retornos (os mais recentes). */
    static final int EVENTOS = 300;
    static final int RETORNOS = 100;

    private final InscricaoRepository inscricoes;
    private final InscricaoNotaRepository notas;
    private final InscricaoEventoRepository eventos;
    private final InscricaoRetornoRepository retornos;
    private final ResponsaveisDaInscricao responsaveis;

    DetalheDaInscricao(InscricaoRepository inscricoes, InscricaoNotaRepository notas, InscricaoEventoRepository eventos,
                       InscricaoRetornoRepository retornos, ResponsaveisDaInscricao responsaveis) {
        this.inscricoes = inscricoes;
        this.notas = notas;
        this.eventos = eventos;
        this.retornos = retornos;
        this.responsaveis = responsaveis;
    }

    InscricaoDetalhe detalhe(Inscricao i) {
        List<InscricaoNota> listaNotas = notas.findByInscricaoIdOrderByCriadaEmAsc(i.getId());
        List<InscricaoEvento> listaEventos = eventos.findByInscricaoIdOrderByCriadoEmDesc(i.getId(), PageRequest.of(0, EVENTOS));
        List<InscricaoRetorno> listaRetornos = retornos.daInscricao(i.getId(), PageRequest.of(0, RETORNOS));
        List<UUID> pessoas = new ArrayList<>(List.of(Objects.requireNonNullElse(i.getResponsavelId(), ZERO),
                Objects.requireNonNullElse(i.getPagamentoConfirmadoPor(), ZERO),
                Objects.requireNonNullElse(i.getEncerradaPor(), ZERO),
                Objects.requireNonNullElse(i.getPropostaAtualizadaPor(), ZERO)));
        listaNotas.forEach(n -> pessoas.add(n.getAutorId()));
        listaEventos.forEach(e -> pessoas.add(e.getAutorId()));
        listaRetornos.forEach(r -> {
            pessoas.add(r.getResponsavelId());
            pessoas.add(r.getConcluidoPor());
        });
        Map<UUID, String> nomes = responsaveis.nomes(pessoas);
        Relacionada relacionada = i.getRelacionadaA() == null ? null : inscricoes.findById(i.getRelacionadaA())
                .map(o -> new Relacionada(o.getId(), o.getNome(), o.getSituacao(), o.getCriadaEm())).orElse(null);
        Proposta proposta = new Proposta(i.getPropostaPlanoId(), i.getPropostaPlanoNome(), i.getPropostaModalidade(),
                i.getPropostaPeriodicidade(), i.getPropostaValorReferenciaCentavos(), i.getPropostaValorCentavos(),
                i.getPropostaCondicoes(), i.getPropostaAtualizadaEm(), nomes.get(i.getPropostaAtualizadaPor()));
        return new InscricaoDetalhe(i.getId(), i.getNome(), i.getWhatsapp(), i.getEmail(), textoLivre(i, i.getObjetivo()),
                textoLivre(i, i.getObservacao()), i.getSexo() == null ? null : i.getSexo().name(), i.getInteresse(),
                i.getModalidadeDesejada(), i.getPrevisaoInicio(), i.getOrigemInformada(), i.getOrigemLink(), i.getOrigem(),
                i.getCienciaEm(), i.getCienciaTexto(), i.getSituacao(), i.getCiclo(), i.getMotivoEncerramento(),
                i.getMotivoDetalhe(), i.getEncerradaEm(), nomes.get(i.getEncerradaPor()), i.getPagamento(),
                nomes.get(i.getPagamentoConfirmadoPor()), i.getPagamentoConfirmadoEm(), i.getResponsavelId(),
                nomes.get(i.getResponsavelId()), alunoVisivel(i.getAlunoId()), i.getAceitaEm(), relacionada, proposta,
                i.getCriadaEm(), i.getAtualizadaEm(), i.getUltimaAtividadeEm(), i.getVersao(),
                duplicidades(List.of(i)).getOrDefault(i.getId(), Duplicidade.NENHUMA),
                listaNotas.stream().map(n -> new Nota(n.getId(), n.getTexto(), n.getAutorId(), nomes.get(n.getAutorId()),
                        n.getCriadaEm())).toList(),
                listaRetornos.stream().map(r -> retorno(r, nomes)).toList(),
                listaEventos.stream().map(e -> new Evento(e.getId(), e.getTipo(), e.getCiclo(), e.getDe(), e.getPara(),
                        e.getMotivo() == null ? null : MotivoEncerramento.valueOf(e.getMotivo()), e.getDetalhe(),
                        nomes.get(e.getAutorId()), e.getCriadoEm())).toList());
    }

    List<InscricaoResumo> resumos(List<Inscricao> lista) {
        Map<UUID, Duplicidade> duplicidades = duplicidades(lista);
        Map<UUID, String> nomes = responsaveis.nomes(lista.stream().map(Inscricao::getResponsavelId).toList());
        Map<UUID, ProximoRetorno> proximos = proximosRetornos(lista);
        return lista.stream().map(i -> new InscricaoResumo(i.getId(), i.getNome(), textoLivre(i, i.getObjetivo()),
                i.getWhatsapp(), i.getEmail(), i.getSituacao(), i.getPagamento(), i.getResponsavelId(),
                nomes.get(i.getResponsavelId()), alunoVisivel(i.getAlunoId()), i.getCriadaEm(), i.getUltimaAtividadeEm(),
                i.getCiclo(), i.getOrigem(), i.getPropostaPlanoNome(), proximos.get(i.getId()), i.getVersao(),
                duplicidades.getOrDefault(i.getId(), Duplicidade.NENHUMA))).toList();
    }

    static Retorno retorno(InscricaoRetorno r, Map<UUID, String> nomes) {
        return new Retorno(r.getId(), r.getDescricao(), r.getData(), r.getResponsavelId(), nomes.get(r.getResponsavelId()),
                r.getConcluidoEm(), nomes.get(r.getConcluidoPor()), r.getCriadoEm(), r.getVersao());
    }

    /** Próximo retorno pendente das inscrições em atendimento da página. */
    private Map<UUID, ProximoRetorno> proximosRetornos(List<Inscricao> lista) {
        List<UUID> abertas = lista.stream().filter(i -> i.getSituacao().aberta()).map(Inscricao::getId).toList();
        if (abertas.isEmpty()) return Map.of();
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        Map<UUID, ProximoRetorno> resultado = new LinkedHashMap<>();
        for (InscricaoRetorno r : retornos.pendentesDe(abertas)) {
            resultado.putIfAbsent(r.getInscricaoId(), new ProximoRetorno(r.getId(), r.getData(), r.getDescricao(),
                    r.getData().isBefore(hoje)));
        }
        return resultado;
    }

    /**
     * Aviso de duplicidade das inscrições não aceitas: aluno com o mesmo e-mail, outras inscrições em atendimento e
     * anteriores (encerradas ou aceitas) com o mesmo e-mail ou WhatsApp. Duas consultas por página.
     */
    Map<UUID, Duplicidade> duplicidades(List<Inscricao> lista) {
        List<Inscricao> conferir = lista.stream().filter(i -> i.getSituacao() != SituacaoInscricao.ACEITA).toList();
        if (conferir.isEmpty()) return Map.of();
        Set<String> emails = conferir.stream().map(Inscricao::getEmail).filter(Objects::nonNull)
                .map(e -> e.toLowerCase(Locale.ROOT)).collect(Collectors.toSet());
        Set<String> whatsapps = conferir.stream().map(Inscricao::getWhatsapp).collect(Collectors.toSet());
        Collection<String> emailsDaConsulta = emails.isEmpty() ? List.of("") : emails;
        var contatos = inscricoes.comContato(emailsDaConsulta, whatsapps);
        Map<String, UUID> alunoPorEmail = new HashMap<>();
        if (!emails.isEmpty()) {
            inscricoes.alunosComEmail(emails).forEach(a -> alunoPorEmail.putIfAbsent(a.email(), a.id()));
        }
        boolean podeVerAlunos = AcessoAtual.pode("ALUNO_LER");
        Map<UUID, Duplicidade> resultado = new HashMap<>();
        for (Inscricao i : conferir) {
            String email = i.getEmail() == null ? null : i.getEmail().toLowerCase(Locale.ROOT);
            var mesmas = contatos.stream().filter(c -> !c.id().equals(i.getId()))
                    .filter(c -> i.getWhatsapp().equals(c.whatsapp()) || (email != null && email.equals(c.email())))
                    .toList();
            int abertas = (int) mesmas.stream().filter(c -> c.situacao().aberta()).count();
            int anteriores = mesmas.size() - abertas;
            UUID aluno = email == null ? null : alunoPorEmail.get(email);
            if (aluno != null || !mesmas.isEmpty()) {
                resultado.put(i.getId(), new Duplicidade(aluno != null, podeVerAlunos ? aluno : null, abertas, anteriores));
            }
        }
        return resultado;
    }

    /**
     * Objetivo e observação da inscrição aceita: ela virou aluno e segue as regras do aluno, cuja ficha só mostra o
     * objetivo e as observações a quem tem {@code ALUNO_SENSIVEL_LER} (revisão de segurança de 19/10). Antes do aceite
     * o texto é de quem atende a fila.
     */
    static String textoLivre(Inscricao i, String texto) {
        return i.getSituacao() == SituacaoInscricao.ACEITA && !AcessoAtual.pode("ALUNO_SENSIVEL_LER") ? null : texto;
    }

    /** O id do aluno só sai para quem pode abrir a ficha. */
    static UUID alunoVisivel(UUID alunoId) {
        return alunoId != null && AcessoAtual.pode("ALUNO_LER") ? alunoId : null;
    }

    private static final UUID ZERO = new UUID(0, 0);
}
